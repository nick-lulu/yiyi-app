(()=>{
  const APP_VERSION='0.5.0';let installPrompt=null;
  const installed=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const bar=document.createElement('div');bar.className='app-install-bar';bar.innerHTML='<div><strong>一衣 App</strong><span>v'+APP_VERSION+' · 手机体验版</span></div><button type="button" id="installApp">添加到桌面</button>';document.querySelector('header').after(bar);
  const dialog=document.createElement('dialog');dialog.className='install-dialog';dialog.innerHTML='<div class="dialog-head"><h2>把一衣放到手机桌面</h2><button type="button" aria-label="关闭安装说明">×</button></div><p>iPhone：用 Safari 打开此链接，点「分享」，再选「添加到主屏幕」。</p><p>Android：用 Chrome 打开，点「安装应用」；也可以在浏览器菜单中选「添加到主屏幕」。</p><p class="muted">这是 PWA 网页 App，无需下载 APK。首次联网打开后，衣橱、计划与反馈可在离线时继续使用；天气需要网络。照片保存在当前设备，建议定期导出。</p>';document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();
  const button=document.querySelector('#installApp');
  function render(){button.textContent=installed()?'已添加到桌面':'添加到桌面';button.disabled=installed()}
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;render()});window.addEventListener('appinstalled',()=>{installPrompt=null;render()});
  button.onclick=async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;render()}else dialog.showModal()};render();
  if('serviceWorker' in navigator&&window.YIYI_PUBLIC)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{bar.querySelector('span').textContent='v'+APP_VERSION+' · 在线模式'}));
})();
