(() => {
  const SVG = 'http://www.w3.org/2000/svg';
  const profiles = {
    self:{label:'我的模特', filename:'fitting-model.png', photoKey:'avatar-selfie', height:175, face:{x:175,y:33,width:49,height:59}},
    partner:{label:'女士模特', filename:'fitting-model-woman.png', photoKey:'avatar-selfie-partner', height:165, face:{x:174,y:28,width:53,height:63}}
  };
  let profileId = state.activeAvatar === 'partner' ? 'partner' : 'self';
  const profile = () => profiles[profileId];
  state.avatarProfiles ||= {};
  let savedPhoto = null;
  let draftPhoto = null;
  let loading = false;
  let photoRequest = 0;
  let ready = false;
  let hasEditedOutfit = false;
  let profileRead = 0;

  const editor = document.createElement('dialog');
  editor.id = 'personalAvatarDialog';
  editor.className = 'wide-dialog personal-avatar-dialog';
  editor.innerHTML = `<div class="dialog-head"><h2>我的专属模特</h2><button type="button" id="closePersonalAvatar" aria-label="关闭模特设置">×</button></div>
    <form id="personalAvatarForm" class="personal-avatar-grid">
      <div class="personal-avatar-inputs">
        <label>编辑档案<select id="editAvatarProfile"><option value="self">我的模特</option><option value="partner">女士模特</option></select></label>
        <label>正面自拍<input id="avatarSelfie" type="file" accept="image/jpeg,image/png,image/webp"></label>
        <p class="muted">自拍只用于替换脸部，照片保存在本机。</p>
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
      <div class="personal-avatar-preview"><div id="avatarLivePreview"></div><p id="avatarPreviewMeasures"></p><small>体型比例参考</small></div>
    </form>`;
  document.body.append(editor);
  const profilePicker = document.createElement('label');
  profilePicker.className = 'avatar-profile-picker';
  profilePicker.hidden = true;
  profilePicker.innerHTML = '试穿模特<select id="fittingAvatarProfile"><option value="self">我的模特</option><option value="partner">女士模特</option></select>';
  $('.preview-tabs').after(profilePicker);

  const originalRenderModel = renderModel;
  const avatarTab = $('#shapeMode');
  avatarTab.textContent = '我的模特';

  function draftMeasurements() {
    const heightInput = $('#avatarHeight');
    const weightInput = $('#avatarWeight');
    const height = heightInput.checkValidity() ? heightInput.valueAsNumber : state.avatar.height;
    const weight = weightInput.checkValidity() ? weightInput.valueAsNumber : (state.avatar.weight ?? 68);
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

  function renderBody(container, proportions, label) {
    const scaleX = 1 + (proportions.size - 100) / 150;
    const scaleY = proportions.height / 175;
    container.innerHTML = `<svg class="realistic-model" viewBox="0 0 400 790" role="img" aria-label="${label}">
      <g data-avatar-scale-x="${scaleX}" data-avatar-scale-y="${scaleY}" transform="translate(200 766) scale(${scaleX} ${scaleY}) translate(-200 -590)">
        <image href="assets/${profile().filename}" x="50" width="300" height="600" preserveAspectRatio="xMidYMid meet"/>
      </g></svg>`;
  }

  async function defaultCrop(image) {
    const faceFrame = profile().face;
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const base = Math.max(faceFrame.width / width, faceFrame.height / height);
    let focus = {x:width * .5, y:height * .41};
    let scale = base * 1.7;
    if (typeof window.FaceDetector === 'function') {
      try {
        const detector = new window.FaceDetector({fastMode:true, maxDetectedFaces:1});
        const [result] = await detector.detect(image);
        if (result) {
          const box = result.boundingBox;
          focus = {x:box.x + box.width / 2, y:box.y + box.height / 2};
          scale = Math.max(base, Math.min(faceFrame.width / (box.width * 1.02), faceFrame.height / (box.height * 1.01)));
        }
      } catch { /* Keep the portrait-centered crop when face detection is unavailable. */ }
    }
    const zoom = Math.max(1, Math.min(4, Math.round(scale / base * 20) / 20));
    scale = base * zoom;
    function position(center, dimension, frame) {
      const overflow = dimension * scale - frame;
      return overflow > 0 ? Math.round(Math.max(0, Math.min(1, (center * scale - frame / 2) / overflow)) * 100) : 50;
    }
    return {zoom, x:position(focus.x, width, faceFrame.width), y:position(focus.y, height, faceFrame.height)};
  }

  function applyCropControls(crop) {
    for (const [id, key, fallback] of [['avatarZoom','zoom',1],['avatarCropX','x',50],['avatarCropY','y',50]]) $('#'+id).value = crop?.[key] ?? fallback;
  }

  function addSelfie(container, photo, crop = {zoom:1, x:50, y:50}) {
    const faceFrame = profile().face;
    const group = container.querySelector('svg > g');
    if (!group || !photo) return;
    const mask = document.createElementNS(SVG, 'svg');
    const zoom = crop.zoom || 1;
    const w = faceFrame.width, h = faceFrame.height;
    const scale = Math.max(w / photo.width, h / photo.height) * zoom;
    const width = photo.width * scale;
    const height = photo.height * scale;
    for (const [key, value] of Object.entries({...faceFrame, viewBox:`0 0 ${w} ${h}`})) mask.setAttribute(key, value);
    const id = container.id + '-selfie-clip';
    const clip = document.createElementNS(SVG, 'clipPath');
    clip.id = id;
    const oval = document.createElementNS(SVG, 'ellipse');
    for (const [key, value] of Object.entries({cx:w/2, cy:h/2, rx:w/2, ry:h/2})) oval.setAttribute(key, value);
    clip.append(oval);
    const photoLayer = document.createElementNS(SVG, 'image');
    for (const [key, value] of Object.entries({x:(w-width)*crop.x/100, y:(h-height)*crop.y/100, width, height, href:photo.src, 'clip-path':`url(#${id})`})) photoLayer.setAttribute(key, value);
    mask.setAttribute('data-face-overlay','');
    mask.append(clip, photoLayer);
    group.append(mask);
  }

  function renderDraft() {
    const preview = $('#avatarLivePreview');
    const {height, weight, width} = draftMeasurements();
    renderBody(preview, getProportions(height, weight, width), '专属模特实时预览');
    $('#avatarPreviewMeasures').textContent = `${height} cm · ${weight} kg`;
    addSelfie(preview, draftPhoto, cropSettings());
    $('#avatarCropControls').hidden = !draftPhoto;
    $('#savePersonalAvatar').disabled = loading || !ready;
  }

  function populateEditor() {
    draftPhoto = savedPhoto;
    const a = state.avatar;
    $('#editAvatarProfile').value = profileId;
    $('#avatarHeight').value = a.personal ? a.height : '';
    $('#avatarWeight').value = a.weight ?? '';
    $('#avatarWidth').value = a.widthAdjustment ?? 0;
    applyCropControls(a.crop);
    $('#avatarSelfie').value = '';
    $('#avatarStatus').textContent = ready ? '' : '正在读取本机模特…';
    renderDraft();
  }

  function openEditor() {
    populateEditor();
    editor.showModal();
  }

  async function readProfilePhoto() {
    const request = ++profileRead;
    const key = profile().photoKey;
    let photo;
    try { photo = await photoStore(key); } catch { photo = null; }
    if (request !== profileRead) return;
    ready = true;
    savedPhoto = photo || null;
    if (editor.open) {
      draftPhoto ||= savedPhoto;
      $('#avatarStatus').textContent = '';
      renderDraft();
    }
    if (previewMode === 'shape') renderModel();
  }

  async function switchProfile(id) {
    if (!Object.hasOwn(profiles,id) || id === profileId || loading) {
      $('#editAvatarProfile').value = profileId;
      $('#fittingAvatarProfile').value = profileId;
      return;
    }
    state.avatarProfiles[profileId] = state.avatar;
    profileId = id;
    state.activeAvatar = id;
    state.avatar = state.avatarProfiles[id] || {
      height:profile().height, size:100, skin:'#d4a78a', hair:'#40382e', hairstyle:'short', style:'neutral'
    };
    ready = false;
    savedPhoto = null;
    persist();
    if (editor.open) populateEditor();
    useAvatarMode();
    await readProfilePhoto();
  }
  $('#editAvatarProfile').onchange = event => { void switchProfile(event.target.value); };
  $('#fittingAvatarProfile').onchange = event => { void switchProfile(event.target.value); };

  function useAvatarMode() {
    previewMode = 'shape';
    avatarTab.classList.add('active');
    $('#photoMode').classList.remove('active');
    renderModel();
  }

  renderModel = function () {
    originalRenderModel();
    profilePicker.hidden = previewMode !== 'shape';
    $('#fittingAvatarProfile').value = profileId;
    if (previewMode !== 'shape') return;
    const a = state.avatar;
    renderBody($('#model'), a, '写实模特搭配预览');
    if (a.personal && savedPhoto) {
      addSelfie($('#model'), savedPhoto, a.crop);
      $('#model svg').setAttribute('aria-label','穿着当前搭配的专属示意模特');
      $('#previewBadge').textContent = '专属模特';
      // Measurements stay in the profile editor so the fitting view can be shared without exposing them.
    }
    $('#lookName').textContent = profile().label;
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
      const crop = await defaultCrop(image);
      if (request !== photoRequest) return;
      draftPhoto = {src, width:image.naturalWidth, height:image.naturalHeight};
      applyCropControls(crop);
      $('#avatarStatus').textContent = '已裁切脸部区域，可用滑块微调。';
    } catch (error) {
      if (request === photoRequest) $('#avatarStatus').textContent = error.message || '无法读取这张图片，请换一张。';
    } finally {
      if (request === photoRequest) { loading = false; renderDraft(); }
    }
  };
  $('#removeAvatarPhoto').onclick = async () => {
    if (loading || !ready) return;
    loading = true;
    renderDraft();
    try {
      await photoStore(profile().photoKey, null);
      photoRequest++;
      loading = false;
      savedPhoto = draftPhoto = null;
      $('#avatarSelfie').value = '';
      $('#avatarStatus').textContent = '已移除本机自拍。';
      renderDraft();
      renderModel();
    } catch { $('#avatarStatus').textContent = '无法移除自拍，请重试。'; }
    finally { loading = false; renderDraft(); }
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
      const key = profile().photoKey;
      await photoStore(key, newPhoto);
      state.avatar = {...previous, ...getProportions(height, weight, width), weight, widthAdjustment:width, crop:cropSettings(), personal:true};
      if (!persist()) {
        state.avatar = previous;
        await photoStore(key, savedPhoto);
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

  readProfilePhoto().then(() => {
    if (!hasEditedOutfit && state.avatar.personal && savedPhoto) useAvatarMode();
  });
})();
