const API_URL='https://api.example.com/products';
const CACHE_NAME='productos-cache-v2';
const OFFLINE_DATA_KEY='offline-products';
const SYNC_INTERVAL=300000;
const ACTIVATION_CODE="GF+30";
const BONUS_EXPIRATION_DAYS=30;
let productos=[];
let currentPage=1;
const itemsPerPage=6;
let onlineStatus=navigator.onLine;
let deferredPrompt=null;
let bonusPoints=2;
let activatedUntil=null;
const form=document.getElementById('productForm');
const productsContainer=document.getElementById('productsContainer');
const connectionStatus=document.getElementById('connectionStatus');
const themeToggle=document.getElementById('themeToggle');
const syncButton=document.getElementById('syncButton');
const sharePanel=document.getElementById('sharePanel');
const shareModal=document.getElementById('shareModal');
const closeModal=document.querySelector('.close-modal');
const bonusModal=document.getElementById('bonusModal');
document.addEventListener('DOMContentLoaded',initApp);
async function initApp(){
    setupTheme();
    setupConnectivity();
    registerServiceWorker();
    setupBonusSystem();
    await loadProducts();
    setupFormEvents();
    setupShareEvents();
    setupDashboardEvents();
    setupModalEvents();
    startSyncInterval();
    setupPWAInstallPrompt();
}
function setupConnectivity(){
    updateOnlineStatus();
    window.addEventListener('online',updateOnlineStatus);
    window.addEventListener('offline',updateOnlineStatus);
}
async function checkInternetConnection(){
    try{
        const response=await fetch('https://www.google.com/favicon.ico',{method:'HEAD',mode:'no-cors',cache:'no-cache'});
        return true;
    }catch(error){
        return false;
    }
}
async function updateOnlineStatus(){
    const wasOnline=onlineStatus;
    onlineStatus=await checkInternetConnection();
    if(onlineStatus!==wasOnline){
        if(onlineStatus){
            connectionStatus.innerHTML='<span>Conectado</span>';
            connectionStatus.className='connection-status';
            await checkOfflineData();
            showNotification('Conexión a Internet restablecida','success');
        }else{
            connectionStatus.innerHTML='<span>Offline</span>';
            connectionStatus.className='connection-status offline';
            showOfflineWarning();
            showNotification('Sin conexión a Internet. Trabajando en modo offline.','warning');
        }
    }
}
async function checkOfflineData(){
    const offlineData=JSON.parse(localStorage.getItem(OFFLINE_DATA_KEY))||[];
    if(offlineData.length>0){
        try{
            await syncOfflineData(offlineData);
            localStorage.removeItem(OFFLINE_DATA_KEY);
            showNotification('Datos offline sincronizados correctamente','success');
        }catch(error){
            console.error('Error al sincronizar datos offline:',error);
        }
    }
}
async function syncOfflineData(offlineData){
    console.log('Sincronizando datos offline:',offlineData);
    await new Promise(resolve=>setTimeout(resolve,1000));
    productos.unshift(...offlineData);
    saveProducts();
    updateDashboard();
}
function showOfflineWarning(){
    const existingWarning=document.querySelector('.offline-warning');
    if(!existingWarning){
        const warning=document.createElement('div');
        warning.className='offline-warning';
        warning.innerHTML='Estás trabajando offline. Los cambios se sincronizarán cuando recuperes la conexión.';
        document.body.appendChild(warning);
    }
}
function startSyncInterval(){
    setInterval(async()=>{
        if(onlineStatus){
            try{
                await syncWithServer();
            }catch(error){
                console.error('Error en sincronización periódica:',error);
            }
        }
    },SYNC_INTERVAL);
}
async function syncWithServer(){
    console.log('Sincronizando con el servidor...');
    return new Promise(resolve=>setTimeout(resolve,500));
}
function setupBonusSystem(){
    const savedActivation=localStorage.getItem('activationExpiry');
    if(savedActivation){
        const expiryDate=new Date(savedActivation);
        if(expiryDate>new Date()){
            activatedUntil=expiryDate;
            createBonusCounter(true);
            return;
        }else{
            localStorage.removeItem('activationExpiry');
        }
    }
    const savedPoints=localStorage.getItem('bonusPoints');
    const lastBonusDate=localStorage.getItem('lastBonusDate');
    const now=new Date();
    if(savedPoints){
        bonusPoints=parseInt(savedPoints);
    }
    if(lastBonusDate){
        const lastDate=new Date(lastBonusDate);
        const hoursDiff=(now-lastDate)/(1000*60*60);
        if(hoursDiff>=24){
            bonusPoints=2;
            localStorage.setItem('lastBonusDate',now.toISOString());
            localStorage.setItem('bonusPoints','2');
            showNotification('¡Has recibido 2 nuevos bonos!','success');
        }
    }else{
        localStorage.setItem('lastBonusDate',now.toISOString());
        bonusPoints=2;
        localStorage.setItem('bonusPoints','2');
    }
    createBonusCounter();
    checkBonusStatus();
}
function createBonusCounter(activated=false){
    const existingCounter=document.querySelector('.bonus-counter');
    if(existingCounter)existingCounter.remove();
    const counter=document.createElement('div');
    counter.className='bonus-counter';
    if(activated){
        const daysLeft=Math.ceil((activatedUntil-new Date())/(1000*60*60*24));
        counter.innerHTML=`Activado (${daysLeft}d)`;
        counter.title=`Plataforma activada hasta ${activatedUntil.toLocaleDateString()}`;
    }else{
        counter.innerHTML=`Bonificación: ${bonusPoints}`;
        if(bonusPoints===1){
            counter.classList.add('warning');
        }else if(bonusPoints===0){
            counter.classList.add('critical');
        }
    }
    counter.onclick=()=>bonusModal.classList.add('active');
    document.body.appendChild(counter);
}
function checkBonusStatus(){
    if(bonusPoints<=0&&!isActivated()){
        showBonusModal();
        disableForm();
    }
}
function isActivated(){
    return activatedUntil&&activatedUntil>new Date();
}
function disableForm(){
    form.querySelectorAll('input, textarea, select, button').forEach(element=>{
        element.disabled=true;
    });
    showNotification('Necesitas un código de activación para continuar','error');
}
function enableForm(){
    form.querySelectorAll('input, textarea, select, button').forEach(element=>{
        element.disabled=false;
    });
}
function showBonusModal(){
    document.getElementById('bonusPoints').textContent=bonusPoints;
    bonusModal.classList.add('active');
}
function closeBonusModal(){
    bonusModal.classList.remove('active');
}
function validateActivationCode(){
    const code=document.getElementById('activationCode').value.trim();
    if(code===ACTIVATION_CODE){
        const expiryDate=new Date();
        expiryDate.setDate(expiryDate.getDate()+BONUS_EXPIRATION_DAYS);
        activatedUntil=expiryDate;
        localStorage.setItem('activationExpiry',expiryDate.toISOString());
        bonusPoints=2;
        localStorage.setItem('bonusPoints','2');
        createBonusCounter(true);
        enableForm();
        closeBonusModal();
        showNotification(`Plataforma activada por ${BONUS_EXPIRATION_DAYS} días`,'success');
    }else{
        showNotification('Código de activación incorrecto','error');
    }
}
function setupTheme(){
    const prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme=localStorage.getItem('theme');
    if(savedTheme){
        document.documentElement.setAttribute('data-theme',savedTheme);
    }else if(prefersDark){
        document.documentElement.setAttribute('data-theme','dark');
    }
    updateThemeIcon();
    themeToggle.addEventListener('click',toggleTheme);
}
function toggleTheme(){
    const currentTheme=document.documentElement.getAttribute('data-theme');
    const newTheme=currentTheme==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',newTheme);
    localStorage.setItem('theme',newTheme);
    updateThemeIcon();
}
function updateThemeIcon(){
    const currentTheme=document.documentElement.getAttribute('data-theme');
    themeToggle.innerHTML=currentTheme==='dark'?'☀':'☾';
}
async function registerServiceWorker(){
    if('serviceWorker'in navigator){
        try{
            const registration=await navigator.serviceWorker.register('service-worker.js');
            console.log('Service Worker registrado con éxito:',registration.scope);
            if('SyncManager'in window){
                registration.sync.register('sync-products');
            }
        }catch(error){
            console.error('Error al registrar Service Worker:',error);
        }
    }
}
function setupPWAInstallPrompt(){
    window.addEventListener('beforeinstallprompt',(e)=>{
        e.preventDefault();
        deferredPrompt=e;
        console.log('PWA puede ser instalado');
    });
}
function setupFormEvents(){
    document.getElementById('incluyeGarantia').addEventListener('change',function(){
        document.getElementById('tiempoGarantiaGroup').style.display=this.checked?'block':'none';
    });
    document.getElementById('precioProducto').addEventListener('input',calculateTotal);
    document.getElementById('cantidadProducto').addEventListener('input',calculateTotal);
    document.getElementById('moneda').addEventListener('change',calculateTotal);
    document.querySelectorAll('.next-section').forEach(button=>{
        button.addEventListener('click',function(){
            const nextSection=this.dataset.next;
            navigateFormSection(nextSection);
        });
    });
    document.querySelectorAll('.prev-section').forEach(button=>{
        button.addEventListener('click',function(){
            const prevSection=this.dataset.prev;
            navigateFormSection(prevSection);
        });
    });
    form.addEventListener('submit',async function(e){
        e.preventDefault();
        if(validateForm()){
            await guardarProducto();
        }
    });
    syncButton.addEventListener('click',async()=>{
        syncButton.innerHTML='⌛';
        try{
            await syncWithServer();
            showNotification('Datos sincronizados correctamente','success');
        }catch(error){
            showNotification('Error al sincronizar datos','error');
        }finally{
            syncButton.innerHTML='🔄';
        }
    });
}
function navigateFormSection(sectionId){
    document.querySelectorAll('.form-section').forEach(section=>{
        section.classList.remove('active');
    });
    document.querySelector(`.form-section[data-section="${sectionId}"]`).classList.add('active');
    form.scrollIntoView({behavior:'smooth',block:'start'});
}
function validateForm(){
    let isValid=true;
    const requiredFields=form.querySelectorAll('[required]');
    requiredFields.forEach(field=>{
        if(!field.value.trim()){
            field.classList.add('invalid');
            isValid=false;
        }else{
            field.classList.remove('invalid');
        }
    });
    const patternFields=form.querySelectorAll('[pattern]');
    patternFields.forEach(field=>{
        const pattern=new RegExp(field.pattern);
        if(!pattern.test(field.value)){
            field.classList.add('invalid');
            isValid=false;
        }else{
            field.classList.remove('invalid');
        }
    });
    if(!isValid){
        showNotification('Por favor complete todos los campos requeridos correctamente','error');
    }
    return isValid;
}
function calculateTotal(){
    const precio=parseFloat(document.getElementById('precioProducto').value)||0;
    const cantidad=parseInt(document.getElementById('cantidadProducto').value)||1;
    const moneda=document.getElementById('moneda').value;
    const total=precio*cantidad;
    const formatter=new Intl.NumberFormat('es-ES',{style:'currency',currency:moneda});
    document.getElementById('totalCalculado').textContent=formatter.format(total);
}
async function guardarProducto(){
    const producto={
        cliente:{
            nombre:document.getElementById('nombreCliente').value,
            ci:document.getElementById('ciCliente').value,
            telefono:document.getElementById('telefonoCliente').value,
            direccion:document.getElementById('direccionCliente').value
        },
        producto:{
            nombre:document.getElementById('nombreProducto').value,
            descripcion:document.getElementById('descripcionProducto').value,
            origen:document.getElementById('origenProducto').value,
            fechaCaducidad:document.getElementById('fechaCaducidad').value,
            precio:parseFloat(document.getElementById('precioProducto').value),
            moneda:document.getElementById('moneda').value,
            cantidad:parseInt(document.getElementById('cantidadProducto').value),
            estado:document.getElementById('estadoProducto').value,
            incluyeDomicilio:document.getElementById('incluyeDomicilio').checked,
            incluyeGarantia:document.getElementById('incluyeGarantia').checked,
            tiempoGarantia:document.getElementById('incluyeGarantia').checked?parseInt(document.getElementById('tiempoGarantia').value):0
        },
        fechaRegistro:new Date().toISOString()
    };
    if(onlineStatus){
        try{
            await saveProductToAPI(producto);
            productos.unshift(producto);
            showNotification('Producto registrado y sincronizado con el servidor','success');
        }catch(error){
            productos.unshift(producto);
            saveOfflineData(producto);
            showNotification('Producto guardado localmente (modo offline)','warning');
        }
    }else{
        productos.unshift(producto);
        saveOfflineData(producto);
        showNotification('Producto guardado localmente (modo offline)','warning');
    }
    saveProducts();
    updateDashboard();
    limpiarFormulario();
    prepareShareProduct(producto);
}
async function saveProductToAPI(producto){
    return new Promise((resolve,reject)=>{
        setTimeout(()=>{
            if(Math.random()<0.1){
                reject(new Error('Error de conexión con el servidor'));
            }else{
                resolve();
            }
        },800);
    });
}
function saveOfflineData(producto){
    let offlineData=JSON.parse(localStorage.getItem(OFFLINE_DATA_KEY))||[];
    offlineData.push(producto);
    localStorage.setItem(OFFLINE_DATA_KEY,JSON.stringify(offlineData));
}
function limpiarFormulario(){
    form.reset();
    document.getElementById('tiempoGarantiaGroup').style.display='none';
    calculateTotal();
    navigateFormSection('cliente');
}
function setupShareEvents(){
    document.querySelectorAll('[data-share]').forEach(button=>{
        button.addEventListener('click',function(){
            const platform=this.dataset.share;
            shareProduct(platform);
        });
    });
}
function setupModalEvents(){
    closeModal.addEventListener('click',()=>{
        shareModal.classList.remove('active');
    });
    shareModal.addEventListener('click',(e)=>{
        if(e.target===shareModal){
            shareModal.classList.remove('active');
        }
    });
    bonusModal.addEventListener('click',(e)=>{
        if(e.target===bonusModal){
            closeBonusModal();
        }
    });
}
function prepareShareProduct(producto){
    document.getElementById('shareProductName').textContent=producto.producto.nombre;
    document.getElementById('shareProductDesc').textContent=producto.producto.descripcion;
    const formatter=new Intl.NumberFormat('es-ES',{style:'currency',currency:producto.producto.moneda});
    document.getElementById('shareProductPrice').textContent=formatter.format(producto.producto.precio);
    sharePanel.scrollIntoView({behavior:'smooth'});
    sharePanel.dataset.productIndex=0;
}
function shareProduct(platform){
    if(!isActivated()){
        if(bonusPoints<=0){
            showBonusModal();
            return;
        }
        bonusPoints--;
        localStorage.setItem('bonusPoints',bonusPoints.toString());
        createBonusCounter();
        checkBonusStatus();
    }
    const productIndex=sharePanel.dataset.productIndex||0;
    const producto=productos[productIndex];
    if(!producto){
        showNotification('No hay producto para compartir','error');
        return;
    }
    const productName=encodeURIComponent(producto.producto.nombre);
    const productDesc=encodeURIComponent(producto.producto.descripcion);
    const productPrice=new Intl.NumberFormat('es-ES',{style:'currency',currency:producto.producto.moneda}).format(producto.producto.precio);
    const textToShare=`¡Mira este producto! ${producto.producto.nombre} - ${producto.producto.descripcion} por solo ${productPrice}`;
    const encodedText=encodeURIComponent(textToShare);
    const url=encodeURIComponent(window.location.href);
    let shareUrl='';
    let modalTitle='';
    let modalContent='';
    switch(platform){
        case'whatsapp':
            shareUrl=`https://wa.me/?text=${encodedText}`;
            modalTitle='Compartir por WhatsApp';
            modalContent=`<p>Compartir <strong>${producto.producto.nombre}</strong> por WhatsApp.</p><a href="${shareUrl}" target="_blank" class="share-btn whatsapp">Abrir WhatsApp</a>`;
            break;
        case'telegram':
            shareUrl=`https://t.me/share/url?url=${url}&text=${encodedText}`;
            modalTitle='Compartir por Telegram';
            modalContent=`<p>Compartir <strong>${producto.producto.nombre}</strong> por Telegram.</p><a href="${shareUrl}" target="_blank" class="share-btn telegram">Abrir Telegram</a>`;
            break;
        case'messenger':
            shareUrl=`fb-messenger://share/?link=${url}&app_id=123456789`;
            modalTitle='Compartir por Messenger';
            modalContent=`<p>Compartir <strong>${producto.producto.nombre}</strong> por Facebook Messenger.</p><a href="${shareUrl}" class="share-btn messenger">Abrir Messenger</a><p>Si el enlace no funciona, abre Messenger manualmente y pega este texto:<br><textarea>${textToShare}</textarea></p>`;
            break;
        case'sms':
            shareUrl=`sms:?body=${encodedText}`;
            modalTitle='Compartir por SMS';
            modalContent=`<p>Compartir <strong>${producto.producto.nombre}</strong> por mensaje de texto.</p><a href="${shareUrl}" class="share-btn sms">Abrir aplicación de mensajes</a><p>Si el enlace no funciona, copia este texto y envíalo manualmente:<br><textarea>${textToShare}</textarea></p>`;
            break;
        case'todus':
            modalTitle='Compartir por ToDus';
            modalContent=`<p>Para compartir <strong>${producto.producto.nombre}</strong> por ToDus:</p><ol><li>Abre la aplicación ToDus</li><li>Pega el siguiente texto en un chat</li></ol><textarea>${textToShare}</textarea><button onclick="copyToClipboard('${textToShare.replace(/'/g,"\\'")}')" class="share-btn todus">Copiar texto</button>`;
            break;
    }
    document.getElementById('modalShareTitle').textContent=modalTitle;
    document.getElementById('modalShareContent').innerHTML=modalContent;
    shareModal.classList.add('active');
}
function copyToClipboard(text){
    navigator.clipboard.writeText(text).then(()=>{
        showNotification('Texto copiado al portapapeles','success');
    }).catch(err=>{
        showNotification('Error al copiar texto','error');
    });
}
async function loadProducts(){
    if(onlineStatus){
        try{
            productos=await fetchProductsFromAPI();
            showNotification('Datos cargados desde el servidor','success');
        }catch(error){
            console.error('Error al cargar desde API:',error);
            productos=JSON.parse(localStorage.getItem('productos'))||[];
            showNotification('Datos cargados localmente','warning');
        }
    }else{
        productos=JSON.parse(localStorage.getItem('productos'))||[];
        showNotification('Modo offline: datos cargados localmente','warning');
    }
    saveProducts();
    updateDashboard();
}
async function fetchProductsFromAPI(){
    return new Promise((resolve)=>{
        setTimeout(()=>{
            const mockProducts=[{
                cliente:{
                    nombre:"Cliente Demo",
                    ci:"12345678901",
                    telefono:"51234567",
                    direccion:"La Habana, Cuba"
                },
                producto:{
                    nombre:"Producto de Ejemplo",
                    descripcion:"Este es un producto de demostración",
                    origen:"importado",
                    fechaCaducidad:"2025-12-31",
                    precio:99.99,
                    moneda:"CUP",
                    cantidad:1,
                    estado:"nuevo",
                    incluyeDomicilio:true,
                    incluyeGarantia:true,
                    tiempoGarantia:12
                },
                fechaRegistro:new Date().toISOString()
            }];
            resolve(mockProducts);
        },1000);
    });
}
function saveProducts(){
    localStorage.setItem('productos',JSON.stringify(productos));
    updateDashboard();
}
function updateDashboard(){
    updateProductsList();
    updateStatistics();
}
function updateProductsList(filter='',statusFilter='all'){
    let filteredProducts=[...productos];
    if(filter){
        const searchTerm=filter.toLowerCase();
        filteredProducts=filteredProducts.filter(p=>
            p.producto.nombre.toLowerCase().includes(searchTerm)||
            p.cliente.nombre.toLowerCase().includes(searchTerm)||
            p.producto.descripcion.toLowerCase().includes(searchTerm)
        );
    }
    if(statusFilter!=='all'){
        filteredProducts=filteredProducts.filter(p=>
            p.producto.estado===statusFilter
        );
    }
    const totalPages=Math.ceil(filteredProducts.length/itemsPerPage);
    const startIndex=(currentPage-1)*itemsPerPage;
    const paginatedProducts=filteredProducts.slice(startIndex,startIndex+itemsPerPage);
    productsContainer.innerHTML='';
    if(paginatedProducts.length===0){
        productsContainer.innerHTML='<p class="no-results">No se encontraron productos</p>';
    }else{
        paginatedProducts.forEach((producto,index)=>{
            const productCard=createProductCard(producto,startIndex+index);
            productsContainer.appendChild(productCard);
        });
    }
    document.getElementById('prevPage').disabled=currentPage===1;
    document.getElementById('nextPage').disabled=currentPage===totalPages||totalPages===0;
    document.getElementById('pageInfo').textContent=`Página ${currentPage} de ${totalPages}`;
}
function createProductCard(producto,index){
    const productCard=document.createElement('div');
    productCard.className='product-card';
    const fechaRegistro=new Date(producto.fechaRegistro).toLocaleString();
    const precioFormateado=new Intl.NumberFormat('es-ES',{style:'currency',currency:producto.producto.moneda}).format(producto.producto.precio);
    productCard.innerHTML=`
        <h3>${producto.producto.nombre}</h3>
        <div class="product-meta">
            <span>${producto.cliente.nombre}</span>
            <span>${fechaRegistro}</span>
        </div>
        <div class="product-price">${precioFormateado}</div>
        <div class="product-details">
            <div class="detail-item">
                <strong>Origen</strong>
                ${capitalizeFirstLetter(producto.producto.origen)}
            </div>
            <div class="detail-item">
                <strong>Cantidad</strong>
                ${producto.producto.cantidad}
            </div>
            <div class="detail-item">
                <strong>Estado</strong>
                ${capitalizeFirstLetter(producto.producto.estado)}
            </div>
            <div class="detail-item">
                <strong>Garantía</strong>
                ${producto.producto.incluyeGarantia?`${producto.producto.tiempoGarantia} meses`:'No incluye'}
            </div>
            <div class="detail-item">
                <strong>Domicilio</strong>
                ${producto.producto.incluyeDomicilio?'Sí':'No'}
            </div>
        </div>
        <div class="product-actions">
            <button onclick="prepareShareFromList(${index})" class="share-btn">Compartir</button>
        </div>
    `;
    return productCard;
}
function prepareShareFromList(index){
    sharePanel.dataset.productIndex=index;
    const producto=productos[index];
    document.getElementById('shareProductName').textContent=producto.producto.nombre;
    document.getElementById('shareProductDesc').textContent=producto.producto.descripcion;
    const formatter=new Intl.NumberFormat('es-ES',{style:'currency',currency:producto.producto.moneda});
    document.getElementById('shareProductPrice').textContent=formatter.format(producto.producto.precio);
    sharePanel.scrollIntoView({behavior:'smooth'});
}
function updateStatistics(){
    document.getElementById('totalProducts').textContent=productos.length;
    const totalValue=productos.reduce((sum,producto)=>{
        return sum+(producto.producto.precio*producto.producto.cantidad);
    },0);
    const defaultCurrency=productos[0]?.producto.moneda||'CUP';
    const formatter=new Intl.NumberFormat('es-ES',{style:'currency',currency:defaultCurrency});
    document.getElementById('totalInventory').textContent=formatter.format(totalValue);
    const withWarranty=productos.filter(p=>p.producto.incluyeGarantia).length;
    document.getElementById('warrantyProducts').textContent=withWarranty;
}
function setupDashboardEvents(){
    document.getElementById('searchProducts').addEventListener('input',function(){
        currentPage=1;
        updateProductsList(this.value,document.getElementById('filterStatus').value);
    });
    document.getElementById('filterStatus').addEventListener('change',function(){
        currentPage=1;
        updateProductsList(document.getElementById('searchProducts').value,this.value);
    });
    document.getElementById('prevPage').addEventListener('click',function(){
        if(currentPage>1){
            currentPage--;
            updateProductsList(
                document.getElementById('searchProducts').value,
                document.getElementById('filterStatus').value
            );
        }
    });
    document.getElementById('nextPage').addEventListener('click',function(){
        const totalPages=Math.ceil(
            getFilteredProducts(
                document.getElementById('searchProducts').value,
                document.getElementById('filterStatus').value
            ).length/itemsPerPage
        );
        if(currentPage<totalPages){
            currentPage++;
            updateProductsList(
                document.getElementById('searchProducts').value,
                document.getElementById('filterStatus').value
            );
        }
    });
    document.getElementById('deleteAllBtn').addEventListener('click',deleteAllProducts);
}
function getFilteredProducts(filter='',statusFilter='all'){
    let filteredProducts=[...productos];
    if(filter){
        const searchTerm=filter.toLowerCase();
        filteredProducts=filteredProducts.filter(p=>
            p.producto.nombre.toLowerCase().includes(searchTerm)||
            p.cliente.nombre.toLowerCase().includes(searchTerm)||
            p.producto.descripcion.toLowerCase().includes(searchTerm)
        );
    }
    if(statusFilter!=='all'){
        filteredProducts=filteredProducts.filter(p=>
            p.producto.estado===statusFilter
        );
    }
    return filteredProducts;
}
function deleteAllProducts(){
    if(confirm('¿Estás seguro de que deseas eliminar todos los productos registrados? Esta acción no se puede deshacer.')){
        productos=[];
        localStorage.removeItem('productos');
        updateDashboard();
        showNotification('Todos los productos han sido eliminados','success');
    }
}
function capitalizeFirstLetter(string){
    return string.charAt(0).toUpperCase()+string.slice(1);
}
function showNotification(message,type='info'){
    const notification=document.createElement('div');
    notification.className=`notification ${type}`;
    notification.textContent=message;
    document.body.appendChild(notification);
    setTimeout(()=>{
        notification.classList.add('fade-out');
        setTimeout(()=>{
            notification.remove();
        },300);
    },3000);
}
window.copyToClipboard=copyToClipboard;
window.prepareShareFromList=prepareShareFromList;
window.closeBonusModal=closeBonusModal;
window.validateActivationCode=validateActivationCode;
window.deleteAllProducts=deleteAllProducts;