(() => {
  const categories = ['top', 'bottom', 'shoes'];
  const labels = {top:'上衣', bottom:'下装', shoes:'鞋子'};
  // Anchors use the pixel coordinates of each model before body scaling.
  const modelFits = {
    self: {neck:[198,95], shoulders:133, waist:[198,265,106], hips:116, feet:[148,244], hem:555, sole:585,
      shirt:'M173 97 Q198 108 221 96 L231 102 Q277 106 280 168 L243 168 L255 269 Q201 280 143 269 L154 166 L116 166 Q116 108 168 102Z',
      pants:'M144 264 Q198 272 252 264 L261 312 L252 547 L223 553 L198 343 L170 552 L141 548 L134 315Z',
      footwear:'M140 548L170 551L178 572V592H117V568Z M221 551L251 548L273 569V592H216V567Z'},
    partner: {neck:[198,93], shoulders:128, waist:[199,260,107], hips:117, feet:[153,244], hem:560, sole:588,
      shirt:'M175 94 Q200 104 220 97 L229 103 Q273 108 278 158 L246 164 L251 264 Q199 272 146 262 L151 160 L119 158 Q121 108 170 101Z',
      pants:'M146 260 Q198 267 250 260 L262 313 L257 550 L225 560 L200 349 L174 559 L139 552 L136 312Z',
      footwear:'M141 553L175 552L182 575V595H126V575Z M219 552L252 553L272 575V595H215V574Z'}
  };
  const photoZones = {top:[27,24,46,31], bottom:[34,51,32,40], shoes:[31,82,38,15]};
  const cutouts = new Map();
  const fittedTrousers = new WeakMap();
  // The catalog's white tee and backdrop share a color. Trace the photographed edge.
  const whiteTeeEdge = 'M149 48 Q155 47 162 52 Q190 58 211 47 Q237 58 261 68 Q312 116 324 135 L281 181 L265 174 L271 319 Q183 321 87 318 L96 175 L78 183 L33 137 Q54 108 94 74 Q110 66 149 48Z';
  const NS = 'http://www.w3.org/2000/svg';
  let fittingRevision = 0;
  let fullBodyPhoto = null;
  let photoMode = false;
  let photoRevision = 0;
  let angle = 0;
  let drag;

  const controls = document.createElement('div');
  controls.className = 'fitting-controls';
  controls.hidden = true;
  controls.innerHTML = `<div class="fitting-picker">
    ${categories.map(cat => `<label>${labels[cat]}<select data-fitting-cat="${cat}"></select></label>`).join('')}
    </div><div class="fitting-actions"><button type="button" class="outline" id="randomFitting">随意搭一套</button><button type="button" class="outline" id="chooseFittingPhoto">用全身照试穿</button></div>
    <div id="fittingPhotoOptions" hidden><label>更换正面全身照<input type="file" id="fittingPhotoFile" accept="image/jpeg,image/png,image/webp"></label><p class="fitting-hint">请使用正面站立、头和鞋都入镜、人物居中的照片。衣服会按固定区域叠放。</p><button type="button" class="outline" id="clearFittingPhoto">删除全身照</button></div>
    <p role="status" id="fittingPhotoStatus" class="fitting-hint"></p>`;
  $('.avatar-profile-picker').after(controls);
  const stage = $('#model');
  const mirror = $('.mirror');
  const turnButton = $('#rotate');
  const angles = document.createElement('div');
  angles.className = 'fitting-angles';
  angles.hidden = true;
  angles.innerHTML = `<label for="fittingAngle">转动预览</label>
    <input id="fittingAngle" type="range" min="-35" max="35" value="0" aria-valuetext="正面">
    <button type="button" class="outline">回正</button>`;
  mirror.after(angles);
  const angleInput = angles.querySelector('input');
  angles.querySelector('button').onclick = () => setAngle(0);
  angleInput.oninput = () => setAngle(angleInput.valueAsNumber);
  turnButton.textContent = '↻';
  turnButton.setAttribute('aria-label', '切换转动预览角度');
  turnButton.onclick = () => setAngle(angle > 0 ? -26 : angle < 0 ? 0 : 26);

  function setAngle(value) {
    angle = Math.max(-35, Math.min(35, Math.round(value)));
    stage.style.setProperty('--fitting-angle', `${angle}deg`);
    angleInput.value = angle;
    angleInput.setAttribute('aria-valuetext', angle === 0 ? '正面' : `${angle < 0 ? '向左' : '向右'} ${Math.abs(angle)} 度`);
  }

  stage.addEventListener('pointerdown', event => {
    if (!stage.classList.contains('turnable-model') || !event.isPrimary || event.button !== 0) return;
    stage.setPointerCapture(event.pointerId);
    drag = {x:event.clientX, angle};
    stage.classList.add('dragging-model');
  });
  stage.addEventListener('pointermove', event => {
    if (drag && stage.hasPointerCapture(event.pointerId)) setAngle(drag.angle + (event.clientX - drag.x) / 3);
  });
  stage.addEventListener('lostpointercapture', () => {
    drag = null;
    stage.classList.remove('dragging-model');
  });
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
    const traceTee = !garment.image && garment.id === 't2';
    if (traceTee) {
      ctx.save();
      ctx.scale(canvas.width / 356, canvas.height / 356);
      ctx.clip(new Path2D(whiteTeeEdge));
      ctx.setTransform(1,0,0,1,0,0);
    }
    ctx.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
    if (traceTee) ctx.restore();
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bounds = isolate(pixels);
    if (!bounds) return null;
    ctx.putImageData(pixels, 0, 0);
    const output = document.createElement('canvas');
    [output.width, output.height] = bounds.slice(2);
    output.getContext('2d').drawImage(canvas, ...bounds, 0, 0, output.width, output.height);
    const cutout = {src:output.toDataURL('image/png'), ratio:output.width / output.height};
    if (garment.cat === 'shoes') cutout.pair = shoePieces(output, garment.image ? null : garment.id);
    else cutout.outline = garmentOutline(output, garment.cat);
    return cutout;
  }

  function garmentOutline(canvas, category) {
    const {width, height} = canvas;
    const {data} = canvas.getContext('2d').getImageData(0, 0, width, height);
    const sample = (levels, start = 0, end = width) => {
      const rows = levels.flatMap(level => {
        const y = Math.floor(height * level);
        let left = start, right = end - 1;
        while (left < end && data[(y * width + left) * 4 + 3] < 128) left++;
        while (right > left && data[(y * width + right) * 4 + 3] < 128) right--;
        return right > left ? [{center:(left + right) / (2 * width), span:(right - left + 1) / width}] : [];
      });
      if (!rows.length) return {center:(start + end) / (2 * width), span:(end - start) / width};
      return {
        center:rows.reduce((sum,row) => sum + row.center, 0) / rows.length,
        span:rows.reduce((sum,row) => sum + row.span, 0) / rows.length
      };
    };
    if (category === 'top') {
      const shoulders = sample([.16,.20,.24]);
      const hem = [.40,.45,.50,.55,.60].map(level => {
        const x = Math.floor(width * level);
        let y = height - 1;
        while (y > 0 && data[(y * width + x) * 4 + 3] < 128) y--;
        return (y + 1) / height;
      }).sort((a,b) => a - b)[2];
      return {collar:sample([.04,.08,.12]), shoulders, hem};
    }
    const cuffs = [.88,.92,.96];
    const middle = Math.floor(width / 2);
    return {waist:sample([.05,.08,.11]), hips:sample([.21,.25,.29]),
      cuffs:[sample(cuffs,0,middle).center, sample(cuffs,middle,width).center], canvas};
  }

  function shoeSeam(columns, forceSplit) {
    const width = columns.length;
    const middle = (width - 1) / 2;
    let seam = Math.round(middle);
    let best = Infinity;
    const peak = Math.max(...columns);
    for (let x = Math.ceil(width * .33); x <= Math.floor(width * .67); x++) {
      const score = columns[x] + Math.abs(x - middle) / width * peak * .16;
      if (score < best) { best = score; seam = x; }
    }
    const left = Math.max(...columns.slice(0, seam));
    const right = Math.max(...columns.slice(seam + 1));
    return forceSplit || (Math.min(left,right) > 0 && columns[seam] < Math.min(left,right) * .55) ? seam : null;
  }

  function shoePieces(canvas, catalogId) {
    const {width, height} = canvas;
    const {data} = canvas.getContext('2d').getImageData(0, 0, width, height);
    const columns = Array.from({length:width}, (_, x) => {
      let count = 0;
      for (let y = 0; y < height; y++) if (data[(y * width + x) * 4 + 3] >= 64) count++;
      return count;
    });
    const seam = shoeSeam(columns, catalogId === 's1' || catalogId === 's2');
    const piece = (start, end, trace) => {
      const copy = document.createElement('canvas');
      copy.width = end - start;
      copy.height = height;
      const ctx = copy.getContext('2d');
      if (trace) {
        ctx.beginPath();
        for (const [x, y] of trace) ctx.lineTo(x * width, y * height);
        ctx.closePath();
        ctx.clip();
      }
      ctx.drawImage(canvas, -start, 0);
      const bounds = isolate(ctx.getImageData(0, 0, copy.width, height));
      if (!bounds) return null;
      const trimmed = document.createElement('canvas');
      [trimmed.width, trimmed.height] = bounds.slice(2);
      trimmed.getContext('2d').drawImage(copy, ...bounds, 0, 0, trimmed.width, trimmed.height);
      return {src:trimmed.toDataURL('image/png'), ratio:trimmed.width / trimmed.height};
    };
    if (catalogId === 's3') {
      const boot = piece(0, width, [[.66,.11],[1,0],[1,1],[.24,1],[.28,.85],[.55,.63],[.66,.43]]);
      if (boot) return [{...boot, flip:true}, boot];
    }
    if (seam !== null) {
      const pair = [piece(0, seam), piece(seam, width)];
      if (pair.every(Boolean)) return pair;
    }
    // An ambiguous photo is drawn once as a group. Mirroring it can put two shoes on each foot.
    return null;
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

  function garmentLayer(garment, cutout, [x, y, width, height], foot) {
    const layer = document.createElementNS(NS, 'image');
    const attributes = {x,y,width,height,href:cutout.src,preserveAspectRatio:'none','data-garment':garment.id,'data-garment-category':garment.cat};
    if (foot) attributes['data-foot'] = foot;
    if (cutout.flip) attributes.transform = `translate(${2 * x + width} 0) scale(-1 1)`;
    for (const [key, value] of Object.entries(attributes)) layer.setAttribute(key, value);
    return layer;
  }

  function shoeBox(cutout, center, sole, maxWidth, maxHeight, axisRatio) {
    const ratio = cutout.ratio / axisRatio;
    const width = Math.min(maxWidth, maxHeight * ratio);
    const height = width / ratio;
    return [center - width / 2, sole - height, width, height];
  }

  function fitTrouserLegs(outline, fit) {
    let cache = fittedTrousers.get(outline);
    if (!cache) fittedTrousers.set(outline, cache = new Map());
    if (cache.has(fit)) return cache.get(fit);

    const {canvas, waist, hips, cuffs} = outline;
    const [center, , waistWidth] = fit.waist;
    const width = Math.max(110, Math.min(155, fit.hips / hips.span));
    const widthAtWaist = Math.max(95, Math.min(160, waistWidth / waist.span));
    const output = document.createElement('canvas');
    const startX = 79;
    const boxWidth = 240;
    const resolution = 2;
    output.width = boxWidth * resolution;
    output.height = canvas.height;
    const ctx = output.getContext('2d');
    const split = Math.round(canvas.width * ((cuffs[0] + cuffs[1]) / 2));
    const offset = center - hips.center * width;
    const corrections = cuffs.map((cuff, i) => fit.feet[i] - (offset + cuff * width));
    for (let row = 0; row < canvas.height; row++) {
      const level = row / canvas.height;
      const waistBlend = Math.max(0, 1 - level / .28);
      const hemBlend = Math.max(0, (level - .43) / .57);
      const rowWidth = width + (widthAtWaist - width) * waistBlend;
      const rowCenter = hips.center + (waist.center - hips.center) * waistBlend;
      const left = (center - rowCenter * rowWidth - startX) * resolution;
      const scale = rowWidth * resolution / canvas.width;
      if (!hemBlend) {
        ctx.drawImage(canvas, 0,row,canvas.width,1, left,row,canvas.width * scale,1);
      } else {
        ctx.drawImage(canvas, 0,row,split,1, left + corrections[0] * hemBlend * resolution,row,split * scale,1);
        ctx.drawImage(canvas, split,row,canvas.width - split,1,
          left + split * scale + corrections[1] * hemBlend * resolution,row,(canvas.width - split) * scale,1);
      }
    }
    const result = {cutout:{src:output.toDataURL('image/png')},
      box:[startX,fit.waist[1],boxWidth,fit.hem - fit.waist[1]]};
    cache.set(fit, result);
    return result;
  }

  function fitLayers(garment, cutout, group, fit) {
    const {cat} = garment;
    if (!fit) {
      const [x,y,width,height] = photoZones[cat];
      if (cat !== 'shoes') return [garmentLayer(garment, cutout, [x,y,width,garment.kind === 'skirt' ? height * .70 : height])];
      const view = group.getBoundingClientRect();
      const aspect = view.width / view.height || fullBodyPhoto.width / fullBodyPhoto.height;
      return [garmentLayer(garment, cutout, shoeBox(cutout,x + width / 2,y + height,width,height,aspect))];
    }
    if (cat === 'shoes') {
      const aspect = Number(group.dataset.avatarScaleX) / Number(group.dataset.avatarScaleY);
      if (!cutout.pair) {
        const [left,right] = fit.feet;
        return [garmentLayer(garment, cutout, shoeBox(cutout,(left + right) / 2,fit.sole,right - left + 43,78,aspect))];
      }
      return cutout.pair.map((shoe, index) => {
        const width = Math.max(41, Math.min(59, 45 / aspect));
        return garmentLayer(garment, shoe, shoeBox(shoe,fit.feet[index],fit.sole,width,76,aspect), index === 0 ? 'left' : 'right');
      });
    }
    if (cat === 'top') {
      const {collar, shoulders, hem} = cutout.outline;
      const [neckX,neckY] = fit.neck;
      const width = Math.max(143, Math.min(187, fit.shoulders / shoulders.span));
      const center = shoulders.center + Math.max(-.045, Math.min(.045, collar.center - shoulders.center)) * .65;
      const height = (fit.waist[1] - neckY + 8) / Math.max(.84, hem);
      return [garmentLayer(garment, cutout, [neckX - width * center,neckY,width,height])];
    }
    if (garment.kind === 'skirt') {
      const {waist} = cutout.outline;
      const [center,y,waistWidth] = fit.waist;
      const width = Math.max(126, Math.min(190, waistWidth / waist.span));
      return [garmentLayer(garment, cutout, [center - width * waist.center,y,width,(fit.hem - y) * .70])];
    }
    const {cutout:shaped, box} = fitTrouserLegs(cutout.outline, fit);
    return [garmentLayer(garment, shaped, box)];
  }

  function maskBase(group, paths) {
    if (!paths.length) return;
    const mask = document.createElementNS(NS, 'mask');
    mask.id = 'fitting-base-mask';
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('x', '0');
    mask.setAttribute('y', '0');
    mask.setAttribute('width', '400');
    mask.setAttribute('height', '600');
    mask.innerHTML = `<rect width="400" height="600" fill="white"/>${paths.map(d => `<path d="${d}" fill="black"/>`).join('')}`;
    const base = group.querySelector('[data-avatar-base]');
    base.before(mask);
    base.setAttribute('mask', `url(#${mask.id})`);
  }

  async function applyOutfitPhotos() {
    const revision = ++fittingRevision;
    controls.hidden = !active();
    const canTurn = active() && !(photoMode && fullBodyPhoto);
    angles.hidden = !canTurn;
    turnButton.hidden = !canTurn;
    stage.classList.toggle('turnable-model', canTurn);
    if (controls.hidden) return;
    for (const cat of categories) {
      const select = picker(cat);
      select.replaceChildren(...state.items.filter(i => i.cat === cat).map(i => new Option(i.name, i.id)));
      select.value = state.selected[cat];
    }
    const usingPhoto = photoMode && fullBodyPhoto;
    const group = outfitGroup();
    if (!group) return;
    const fit = usingPhoto ? null : modelFits[group.dataset.avatarProfile];
    const garments = (fit ? ['shoes','bottom','top'] : ['bottom','top','shoes']).map(cat => item(state.selected[cat])).filter(Boolean);
    const status = $('#fittingPhotoStatus');
    status.textContent = '正在准备服装照片…';
    const sources = await Promise.all(garments.map(getCutout));
    if (revision !== fittingRevision || !group.isConnected) return;
    const missing = [];
    const masks = [];
    sources.forEach((source, index) => {
      const garment = garments[index];
      if (!source) { missing.push(labels[garment.cat]); return; }
      for (const layer of fitLayers(garment, source, group, fit)) {
        group.insertBefore(layer, group.querySelector('[data-face-overlay]'));
      }
      if (fit && garment.cat === 'top') masks.push(fit.shirt);
      if (fit && garment.cat === 'bottom' && garment.kind !== 'skirt') masks.push(fit.pants);
      if (fit && garment.cat === 'shoes') masks.push(fit.footwear);
    });
    if (fit) maskBase(group, masks);
    const shoeIndex = garments.findIndex(garment => garment.cat === 'shoes');
    const shoes = sources[shoeIndex];
    status.textContent = missing.length ? `${missing.join('、')}照片背景未能分离。请用纯色背景平铺重拍后试穿。`
      : fit && shoes && !shoes.pair ? '这张鞋照按整张预览。将两只鞋并排留出间距拍摄，即可分别穿到左右脚。' : '';
    $('#previewNote').textContent = fit
      ? '选衣后自动试穿。拖动模特可看正面透视，实际合身度以实穿为准。'
      : '全身照搭配预览。实际合身度以实穿为准。';
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
  modelTab.click();
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
