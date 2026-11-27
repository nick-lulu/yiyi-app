(() => {
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('yiyi-wardrobe', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('garmentPhotos');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function transaction(mode, operation) {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('garmentPhotos', mode);
        const request = operation(tx.objectStore('garmentPhotos'));
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(tx.error || Error('无法保存衣物照片'));
      });
    } finally {
      db.close();
    }
  }

  const read = id => transaction('readonly', store => store.get(id));
  const save = (id, image) => transaction('readwrite', store => store.put(image, id));
  const remove = id => transaction('readwrite', store => store.delete(id));

  async function load() {
    const legacy = [];
    let unavailable = false;
    for (const garment of state.items) {
      try {
        if (garment.imageStored) {
          garment.image = await read(garment.id);
          if (!garment.image) unavailable = true;
        } else if (garment.image) {
          // Keep the legacy copy until the database has committed the photo.
          await save(garment.id, garment.image);
          legacy.push(garment);
        }
      } catch {
        unavailable = true;
      }
    }
    for (const garment of legacy) garment.imageStored = true;
    if (legacy.length && !persist()) {
      for (const garment of legacy) delete garment.imageStored;
    }
    renderClothes();
    renderModel();
    renderWeek();
    if (unavailable) toast('部分照片暂时无法读取，请在常用浏览器中重开页面。');
    return !unavailable;
  }

  const ready = load();
  window.yiyiWardrobeStorage = {
    ready, save, remove,
    async clear() {
      await ready;
      await transaction('readwrite', store => store.clear());
    }
  };

  const form = $('#uploadForm');
  const dialog = $('#uploadDialog');
  const album = $('#uploadFile');
  const camera = $('#uploadCamera');
  const preview = $('#uploadPreview');
  const submit = form.querySelector('button[type="submit"]');
  const status = $('#uploadStatus');
  const close = dialog.querySelector('.close');
  const take = $('#takeGarmentPhoto');
  const storage = window.yiyiWardrobeStorage;
  const saved = document.createElement('div');
  saved.className = 'mvp-saved';
  saved.hidden = true;
  const savedText = document.createElement('span');
  savedText.setAttribute('role','status');
  const addAnother = document.createElement('button');
  addAnother.type = 'button';
  addAnother.className = 'outline upload-trigger';
  addAnother.textContent = '再加一件';
  saved.append(savedText, addAnother);
  $('#filters').before(saved);
  const planToday = document.createElement('button');
  planToday.className = 'outline';
  planToday.type = 'button';
  planToday.textContent = '加入计划';
  planToday.onclick = () => $('#saveLook').click();
  $('.daily-buttons').append(planToday);
  let photo;
  let request = 0;

  function reset() {
    request++;
    photo = null;
    form.reset();
    preview.removeAttribute('src');
    preview.hidden = true;
    submit.disabled = true;
    status.textContent = '';
  }

  async function preparePhoto(event) {
    const file = event.target.files[0];
    if (!file || storage.saving) return;
    const version = ++request;
    photo = null;
    submit.disabled = preview.hidden = true;
    if (file.size > 20 * 1024 * 1024) {
      status.textContent = '照片超过 20 MB，请选一张较小的照片。';
      event.target.value = '';
      return;
    }
    status.textContent = '正在读取照片…';
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (version !== request) return;
      const scale = Math.min(1, 900 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      photo = canvas.toDataURL('image/webp', .84);
      preview.src = photo;
      preview.hidden = submit.disabled = false;
      status.textContent = '';
    } catch {
      if (version !== request) return;
      status.textContent = '这张照片无法读取。请直接拍照，或从相册选择 JPG / PNG。';
      event.target.value = '';
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  album.onchange = camera.onchange = preparePhoto;
  take.onclick = () => camera.click();
  for (const trigger of $$('.upload-trigger')) trigger.onclick = () => {
    if (!storage.saving) open('#uploadDialog');
  };
  dialog.addEventListener('close', () => {
    if (!storage.saving) reset();
  });
  dialog.addEventListener('cancel', event => {
    if (storage.saving) event.preventDefault();
  });
  form.onsubmit = async event => {
    event.preventDefault();
    if (!photo || storage.saving) return;
    const cat = $('#uploadCategory').value;
    const name = $('#uploadName').value.trim();
    if (!name) {
      status.textContent = '请给这件单品写个名称。';
      return;
    }
    const garment = {id:'u' + crypto.randomUUID(), name, cat, image:photo, imageStored:true,
      color:$('#uploadColor').value, kind:{top:'tee',bottom:'wide',shoes:'sneaker'}[cat],
      tag:'我的实拍', warmth:$('#uploadWarmth').value, occasion:$('#uploadOccasion').value};

    storage.saving = true;
    submit.disabled = close.disabled = album.disabled = camera.disabled = take.disabled = true;
    status.textContent = '正在保存到本机衣橱…';
    try {
      await ready;
      await save(garment.id, garment.image);
      const previous = state.selected[cat];
      state.items.unshift(garment);
      state.selected[cat] = garment.id;
      if (!persist()) {
        state.items.shift();
        state.selected[cat] = previous;
        await remove(garment.id);
        throw Error('无法保存单品信息');
      }
    } catch {
      status.textContent = '保存失败。请检查浏览器存储空间，再点保存重试。';
      return;
    } finally {
      storage.saving = false;
      submit.disabled = close.disabled = album.disabled = camera.disabled = take.disabled = false;
    }
    filter = 'all';
    for (const button of $$('[data-cat]')) button.classList.toggle('active', button.dataset.cat === 'all');
    dialog.close();
    reset();
    switchView('wardrobe');
    renderClothes();
    renderModel();
    const label = {top:'上衣',bottom:'下装',shoes:'鞋子'}[cat];
    savedText.textContent = `已保存 · ${label} / ${garment.name}`;
    saved.hidden = false;
  };
  reset();
})();
