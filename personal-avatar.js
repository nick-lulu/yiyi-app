(() => {
  const SVG = 'http://www.w3.org/2000/svg';
  const storageKey = 'avatar-selfie';
  let savedPhoto = null;
  let draftPhoto = null;
  let loading = false;
  let photoRequest = 0;
  let ready = false;
  let hasEditedOutfit = false;

  const editor = document.createElement('dialog');
  editor.id = 'personalAvatarDialog';
  editor.className = 'wide-dialog personal-avatar-dialog';
  editor.innerHTML = `<div class="dialog-head"><h2>我的专属模特</h2><button type="button" id="closePersonalAvatar" aria-label="关闭模特设置">×</button></div>
    <form id="personalAvatarForm" class="personal-avatar-grid">
      <div class="personal-avatar-inputs">
        <label>正面自拍<input id="avatarSelfie" type="file" accept="image/jpeg,image/png,image/webp"></label>
        <p class="muted">选一张脸部清晰的正面自拍。照片保存在当前浏览器，不上传。</p>
        <div id="avatarCropControls" hidden>
          <label>脸部缩放<input id="avatarZoom" type="range" min="1" max="4" step="0.05" value="1"></label>
          <label>左右裁切位置<input id="avatarCropX" type="range" min="0" max="100" value="50"></label>
          <label>上下裁切位置<input id="avatarCropY" type="range" min="0" max="100" value="50"></label>
          <button type="button" id="removeAvatarPhoto" class="outline">移除自拍</button>
        </div>
        <div class="personal-avatar-measurements">
          <label>身高（cm）<input id="avatarHeight" type="number" inputmode="decimal" min="120" max="230" step="0.1" placeholder="180" required></label>
          <label>体重（kg）<input id="avatarWeight" type="number" inputmode="decimal" min="30" max="250" step="0.1" placeholder="90" required></label>
        </div>
        <label>体型宽度微调<input id="avatarWidth" type="range" min="-15" max="15" step="1" value="0"></label>
        <button type="submit" class="dark full" id="savePersonalAvatar">生成并保存模特</button>
        <p id="avatarStatus" role="status" class="muted"></p>
      </div>
      <div class="personal-avatar-preview"><div id="avatarLivePreview"></div><p>自拍面部与示意体型</p><small>身高和体重只用于调整轮廓比例。服装展示是颜色和版型参考。</small></div>
    </form>`;
  document.body.append(editor);

  const originalShowAvatar = showAvatar;
  const originalRenderModel = renderModel;
  const avatarTab = $('#shapeMode');
  avatarTab.textContent = '我的模特';
  const details = document.createElement('button');
  details.type = 'button';
  details.className = 'outline';
  details.textContent = '调整发型和肤色';
  details.onclick = () => { editor.close(); originalShowAvatar(); };
  const previewCaption = editor.querySelector('.personal-avatar-preview');
  previewCaption.append(details);

  function draftMeasurements() {
    const height = $('#avatarHeight').valueAsNumber;
    const weight = $('#avatarWeight').valueAsNumber;
    const width = Number($('#avatarWidth').value);
    return {height, weight, width};
  }

  function getProportions(height, weight, width) {
    const referenceWeight = 68 * (height / 175) ** 2;
    const size = Math.min(145, Math.max(76, Math.round(100 + (Math.sqrt(weight / referenceWeight) - 1) * 100 + width)));
    return {height, size};
  }

  function cropSettings() {
    return {zoom:Number($('#avatarZoom').value), x:Number($('#avatarCropX').value), y:Number($('#avatarCropY').value)};
  }

  function addSelfie(container, photo, crop = {zoom:1, x:50, y:50}) {
    const group = container.querySelector('svg > g');
    if (!group || !photo) return;
    const mask = document.createElementNS(SVG, 'svg');
    const zoom = crop.zoom || 1;
    const scale = Math.max(52 / photo.width, 68 / photo.height) * zoom;
    const width = photo.width * scale;
    const height = photo.height * scale;
    for (const [key, value] of Object.entries({x:97, y:25, width:52, height:68, viewBox:'0 0 52 68'})) mask.setAttribute(key, value);
    const id = container.id + '-selfie-clip';
    const clip = document.createElementNS(SVG, 'clipPath');
    clip.id = id;
    const oval = document.createElementNS(SVG, 'ellipse');
    for (const [key, value] of Object.entries({cx:26, cy:34, rx:26, ry:34})) oval.setAttribute(key, value);
    clip.append(oval);
    const photoLayer = document.createElementNS(SVG, 'image');
    for (const [key, value] of Object.entries({x:(52-width)*crop.x/100, y:(68-height)*crop.y/100, width, height, href:photo.src, 'clip-path':`url(#${id})`})) photoLayer.setAttribute(key, value);
    mask.setAttribute('data-face-overlay','');
    mask.append(clip, photoLayer);
    group.append(mask);
  }

  function renderDraft() {
    const preview = $('#avatarLivePreview');
    const {height, weight, width} = draftMeasurements();
    const previous = state.avatar;
    if ($('#avatarHeight').checkValidity() && $('#avatarWeight').checkValidity()) state.avatar = {...previous, ...getProportions(height, weight, width)};
    try { preview.innerHTML = modelSVG(); } finally { state.avatar = previous; }
    preview.querySelector('svg').setAttribute('aria-label','专属模特实时预览');
    addSelfie(preview, draftPhoto, cropSettings());
    $('#avatarCropControls').hidden = !draftPhoto;
    $('#savePersonalAvatar').disabled = loading || !ready;
  }

  function openEditor() {
    draftPhoto = savedPhoto;
    const a = state.avatar;
    $('#avatarHeight').value = a.personal ? a.height : '';
    $('#avatarWeight').value = a.weight ?? '';
    $('#avatarWidth').value = a.widthAdjustment ?? 0;
    for (const [id, key, fallback] of [['avatarZoom','zoom',1],['avatarCropX','x',50],['avatarCropY','y',50]]) $('#'+id).value = a.crop?.[key] ?? fallback;
    $('#avatarSelfie').value = '';
    $('#avatarStatus').textContent = ready ? '' : '正在读取本机模特…';
    renderDraft();
    editor.showModal();
  }

  function useAvatarMode() {
    previewMode = 'shape';
    avatarTab.classList.add('active');
    $('#photoMode').classList.remove('active');
    renderModel();
  }

  renderModel = function () {
    originalRenderModel();
    if (previewMode !== 'shape') return;
    const a = state.avatar;
    if (a.personal && savedPhoto) {
      addSelfie($('#model'), savedPhoto, a.crop);
      $('#model svg').setAttribute('aria-label','穿着当前搭配的专属示意模特');
      $('#previewBadge').textContent = '专属模特';
      // Measurements stay in the profile editor so the fitting view can be shared without exposing them.
      $('#lookName').textContent = '我的专属模特';
    }
    $('#previewNote').textContent = '颜色与版型示意，实际合身程度请以试穿为准。';
  };

  ['#editAvatar','#avatarNav','#profile'].forEach(selector => $(selector).onclick = openEditor);
  avatarTab.onclick = () => { hasEditedOutfit = true; if (state.avatar.personal && savedPhoto) useAvatarMode(); else openEditor(); };
  $('#photoMode').addEventListener('click', () => { hasEditedOutfit = true; });
  $('#closePersonalAvatar').onclick = () => editor.close();
  editor.addEventListener('close', () => { photoRequest++; loading = false; });
  $('#personalAvatarForm').addEventListener('input', renderDraft);
  $('#avatarSelfie').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    const request = ++photoRequest;
    loading = true;
    $('#avatarStatus').textContent = '正在读取自拍…';
    renderDraft();
    try {
      const src = await compressPhoto(file);
      const image = new Image();
      image.src = src;
      await image.decode();
      if (request !== photoRequest) return;
      draftPhoto = {src, width:image.naturalWidth, height:image.naturalHeight};
      $('#avatarStatus').textContent = '调整下方滑块，让脸位于预览中央。';
    } catch (error) {
      if (request === photoRequest) $('#avatarStatus').textContent = error.message || '无法读取这张图片，请换一张。';
    } finally {
      if (request === photoRequest) { loading = false; renderDraft(); }
    }
  };
  $('#removeAvatarPhoto').onclick = async () => {
    try {
      await photoStore(storageKey, null);
      photoRequest++;
      loading = false;
      savedPhoto = draftPhoto = null;
      $('#avatarSelfie').value = '';
      $('#avatarStatus').textContent = '已移除本机自拍。';
      renderDraft();
      renderModel();
    } catch { $('#avatarStatus').textContent = '无法移除自拍，请重试。'; }
  };
  $('#personalAvatarForm').onsubmit = async event => {
    event.preventDefault();
    if (loading || !ready) return;
    if (!draftPhoto) { $('#avatarStatus').textContent = '请先选择一张正面自拍。'; return; }
    loading = true;
    renderDraft();
    const previous = state.avatar;
    const {height, weight, width} = draftMeasurements();
    const newPhoto = draftPhoto;
    try {
      await photoStore(storageKey, newPhoto);
      state.avatar = {...previous, ...getProportions(height, weight, width), weight, widthAdjustment:width, crop:cropSettings(), personal:true};
      if (!persist()) {
        state.avatar = previous;
        await photoStore(storageKey, savedPhoto);
        throw Error('本机存储空间不足，未保存模特。');
      }
      savedPhoto = newPhoto;
      editor.close();
      switchView('studio');
      useAvatarMode();
      $('.fitting').scrollIntoView({behavior:'smooth', block:'start'});
      toast('专属模特已保存。点击衣物即可换搭配。');
    } catch (error) {
      $('#avatarStatus').textContent = error.message || '无法保存模特，请重试。';
    } finally { loading = false; renderDraft(); }
  };

  photoStore(storageKey).then(photo => {
    savedPhoto = photo || null;
    ready = true;
    if (editor.open) { draftPhoto ||= savedPhoto; renderDraft(); }
    if (!hasEditedOutfit && state.avatar.personal && savedPhoto) useAvatarMode();
  }).catch(() => {
    ready = true;
    if (editor.open) renderDraft();
  });
})();
