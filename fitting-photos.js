(() => {
  const categories = ['top', 'bottom', 'shoes'];
  const labels = {top:'上衣', bottom:'下装', shoes:'鞋子'};
  const modelZones = {top:[121,100,158,171], bottom:[131,262,138,293], shoes:[123,518,154,71]};
  const photoZones = {top:[27,24,46,31], bottom:[34,51,32,40], shoes:[31,82,38,15]};
  const cutouts = new Map();
  const NS = 'http://www.w3.org/2000/svg';
  let fittingRevision = 0;
  let fullBodyPhoto = null;
  let photoMode = false;
  let photoRevision = 0;

  const controls = document.createElement('div');
  controls.className = 'fitting-controls';
  controls.hidden = true;
  controls.innerHTML = `<div class="fitting-picker">
    ${categories.map(cat => `<label>${labels[cat]}<select data-fitting-cat="${cat}"></select></label>`).join('')}
    </div><div class="fitting-actions"><button type="button" class="outline" id="randomFitting">随意搭一套</button><button type="button" class="outline" id="chooseFittingPhoto">用全身照试穿</button></div>
    <div id="fittingPhotoOptions" hidden><label>更换正面全身照<input type="file" id="fittingPhotoFile" accept="image/jpeg,image/png,image/webp"></label><p class="fitting-hint">请使用正面站立、头和鞋都入镜、人物居中的照片。衣服会按固定区域叠放。</p><button type="button" class="outline" id="clearFittingPhoto">删除全身照</button></div>
    <p role="status" id="fittingPhotoStatus" class="fitting-hint"></p>`;
  $('.avatar-profile-picker').after(controls);
  const picker = category => controls.querySelector(`[data-fitting-cat="${category}"]`);
  const active = () => previewMode === 'shape';

  function loadImage(src) {
    const image = new Image();
    image.src = src;
    return image.decode().then(() => image);
  }

  // Isolate a foreground on transparent or plain backgrounds. Preserve uncertain images as originals.
  function isolate({data, width, height}, tolerance = 44) {
    let alphaPixels = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 32) alphaPixels++;
    if (alphaPixels < width * height / 100) {
      const corners = [0, width - 1, width * (height - 1), width * height - 1];
      const background = [0, 1, 2].map(channel => corners.reduce((sum, i) => sum + data[i * 4 + channel], 0) / corners.length);
      const distance = i => Math.hypot(data[i*4]-background[0], data[i*4+1]-background[1], data[i*4+2]-background[2]);
      if (corners.some(i => distance(i) > 40)) return null;
      const seen = new Uint8Array(width * height);
      const queue = new Int32Array(seen.length);
      let first = 0, last = 0;
      const enqueue = i => {
        if (seen[i]) return;
        seen[i] = 1;
        if (distance(i) <= tolerance) queue[last++] = i;
      };
      for (let x = 0; x < width; x++) { enqueue(x); enqueue(x + width * (height - 1)); }
      for (let y = 0; y < height; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
      while (first < last) {
        const index = queue[first++];
        data[index * 4 + 3] = 0;
        if (index % width > 0) enqueue(index - 1);
        if (index % width < width - 1) enqueue(index + 1);
        if (index >= width) enqueue(index - width);
        if (index < seen.length - width) enqueue(index + width);
      }
      if (last < seen.length * 0.12 || last > seen.length * 0.96) return null;
    }
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 64) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    if (right - left < 10 || bottom - top < 10) return null;
    return [left, top, right - left + 1, bottom - top + 1];
  }

  async function createCutout(garment) {
    let source = garment.image;
    let index = -1;
    if (!source) {
      source = 'assets/wardrobe-photography.png';
      index = PHOTO_IDS.indexOf(garment.id);
      if (index < 0) return null;
    }
    const image = await loadImage(source);
    let x = 0, y = 0, width = image.naturalWidth, height = image.naturalHeight;
    if (index >= 0) {
      width = Math.floor(width / 3); height = Math.floor(height / 4);
      x = width * (index % 3) + 3; y = height * Math.floor(index / 3) + 3;
      width -= 6; height -= 6;
    }
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 320 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    ctx.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bounds = isolate(pixels, !garment.image && garment.id === 't2' ? 17 : 44);
    if (!bounds) return null;
    ctx.putImageData(pixels, 0, 0);
    const output = document.createElement('canvas');
    [output.width, output.height] = bounds.slice(2);
    output.getContext('2d').drawImage(canvas, ...bounds, 0, 0, output.width, output.height);
    return {src:output.toDataURL('image/png'), ratio:output.width / output.height};
  }

  function getCutout(garment) {
    if (!cutouts.has(garment.id)) cutouts.set(garment.id, createCutout(garment).catch(() => null));
    return cutouts.get(garment.id);
  }

  function outfitGroup() {
    if (!photoMode || !fullBodyPhoto) return $('#model svg > g:last-child');
    const frame = document.createElement('div');
    frame.className = 'fitting-body-photo';
    const base = new Image();
    base.src = fullBodyPhoto.src;
    base.alt = '正在试穿的本人全身照';
    const layer = document.createElementNS(NS, 'svg');
    layer.setAttribute('viewBox', '0 0 100 100');
    layer.setAttribute('preserveAspectRatio','none');
    layer.setAttribute('aria-hidden','true');
    frame.style.aspectRatio = `${fullBodyPhoto.width} / ${fullBodyPhoto.height}`;
    frame.append(base, layer);
    $('#model').replaceChildren(frame);
    $('#previewBadge').textContent = '全身照试穿';
    $('#lookName').textContent = '我的全身照搭配';
    return layer;
  }

  function overlayBox(garment, cutout, group, usingPhoto) {
    const box = (usingPhoto ? photoZones : modelZones)[garment.cat];
    const [x,y,width,height] = box;
    if (garment.cat !== 'shoes') {
      if (garment.kind === 'skirt') return [x,y,width,height * .70];
      return box;
    }
    // Match the physical image ratio after the model or photo viewport is scaled.
    const viewport = usingPhoto ? group.getBoundingClientRect() : null;
    const axisRatio = usingPhoto ? (viewport.width / viewport.height || fullBodyPhoto.width / fullBodyPhoto.height) :
      Number(group.dataset.avatarScaleX || 1) / Number(group.dataset.avatarScaleY || 1);
    const ratio = cutout.ratio / axisRatio;
    const shoeWidth = Math.min(width, height * ratio);
    const shoeHeight = shoeWidth / ratio;
    return [x + (width - shoeWidth) / 2, y + height - shoeHeight, shoeWidth, shoeHeight];
  }

  async function applyOutfitPhotos() {
    const revision = ++fittingRevision;
    controls.hidden = !active();
    if (controls.hidden) return;
    for (const cat of categories) {
      const select = picker(cat);
      select.replaceChildren(...state.items.filter(i => i.cat === cat).map(i => new Option(i.name, i.id)));
      select.value = state.selected[cat];
    }
    const usingPhoto = photoMode && fullBodyPhoto;
    const group = outfitGroup();
    if (!group) return;
    const garments = ['bottom','top','shoes'].map(cat => item(state.selected[cat])).filter(Boolean);
    const status = $('#fittingPhotoStatus');
    status.textContent = '正在准备服装照片…';
    const sources = await Promise.all(garments.map(getCutout));
    if (revision !== fittingRevision || !group.isConnected) return;
    const missing = [];
    sources.forEach((source, index) => {
      const garment = garments[index];
      if (!source) { missing.push(labels[garment.cat]); return; }
      const [x,y,width,height] = overlayBox(garment, source, group, usingPhoto);
      const layer = document.createElementNS(NS, 'image');
      for (const [key,value] of Object.entries({x,y,width,height,href:source.src,preserveAspectRatio:'none','data-garment':garment.id})) layer.setAttribute(key,value);
      group.insertBefore(layer, group.querySelector('[data-face-overlay]'));
    });
    status.textContent = missing.length ? `${missing.join('、')}未能去背景${usingPhoto ? '，原照片相应区域保留' : '，已保留轮廓示意'}。建议用纯色背景平铺拍摄。` : '';
    $('#previewNote').textContent = '照片叠穿参考。可查看配色和款式，实际合身程度以试穿为准。';
  }

  const previousRender = renderModel;
  renderModel = function () { previousRender(); void applyOutfitPhotos(); };

  const modelTab = $('#shapeMode');
  modelTab.onclick = () => {
    photoMode = false;
    $('#fittingPhotoOptions').hidden = true;
    $('#chooseFittingPhoto').textContent = '用全身照试穿';
    previewMode = 'shape';
    modelTab.classList.add('active');
    $('#photoMode').classList.remove('active');
    renderModel();
  };
  $('#openTryon').textContent = '试穿当前搭配';
  function openFitting() {
    switchView('studio');
    modelTab.click();
    $('.fitting').scrollIntoView({block:'start',behavior:'smooth'});
  }
  $('#openTryon').onclick = openFitting;
  $('#avatarNav').onclick = openFitting;
  for (const cat of categories) picker(cat).onchange = event => {
    state.selected[cat] = event.target.value;
    persist(); renderClothes(); renderModel();
  };
  $('#randomFitting').onclick = () => {
    for (const cat of categories) {
      const pool = state.items.filter(i => i.cat === cat && i.id !== state.selected[cat] && !state.dirty[i.id]);
      if (pool.length) state.selected[cat] = pool[Math.floor(Math.random() * pool.length)].id;
    }
    persist(); renderClothes(); renderModel();
  };
  $('#chooseFittingPhoto').onclick = () => {
    photoMode = !photoMode;
    $('#fittingPhotoOptions').hidden = !photoMode;
    $('#chooseFittingPhoto').textContent = photoMode ? '返回我的模特' : '用全身照试穿';
    if (photoMode && !fullBodyPhoto) $('#fittingPhotoFile').focus();
    renderModel();
  };
  $('#fittingPhotoFile').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    const revision = ++photoRevision;
    const status = $('#fittingPhotoStatus');
    status.textContent = '正在读取全身照…';
    try {
      const src = await compressPhoto(file);
      const image = await loadImage(src);
      if (revision !== photoRevision) return;
      const photo = {src,width:image.naturalWidth,height:image.naturalHeight};
      await photoStore('fitting-body-photo', photo);
      if (revision !== photoRevision) return;
      fullBodyPhoto = photo;
      renderModel();
    } catch (e) { if (revision === photoRevision) status.textContent = e.message; }
  };
  $('#clearFittingPhoto').onclick = async () => {
    photoRevision++;
    try {
      await photoStore('fitting-body-photo', null);
      await photoStore('person', null);
      fullBodyPhoto = null;
      $('#fittingPhotoFile').value = '';
      renderModel();
    } catch { $('#fittingPhotoStatus').textContent = '无法删除本机照片，请重试。'; }
  };
  (async () => {
    const revision = photoRevision;
    try {
      const saved = await photoStore('fitting-body-photo');
      const legacy = saved ? null : await photoStore('person');
      const image = legacy ? await loadImage(legacy) : null;
      if (revision !== photoRevision) return;
      fullBodyPhoto = saved || (image && {src:legacy,width:image.naturalWidth,height:image.naturalHeight});
      if (active()) renderModel();
    } catch { /* Fitting stays available with the default model. */ }
  })();
})();
