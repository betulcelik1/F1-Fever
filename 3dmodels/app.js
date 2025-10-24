import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

class ModelViewer {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.controls = null;
        
        // LoadingManager to coordinate HDR and GLB loading
        this.manager = new THREE.LoadingManager();
        
        // Setup loading manager callbacks
        this.manager.onLoad = () => {
            console.log('Tüm varlıklar yüklendi! Animasyon başlıyor.');
            this.animate(); // Start render loop only after everything is loaded
        };
        
        this.manager.onError = (url) => {
            console.error('Şu varlık yüklenirken hata oluştu: ' + url);
        };
        
        // Initialize loaders with manager
        this.loader = new GLTFLoader(this.manager);
        this.rgbeLoader = new RGBELoader(this.manager); // HDR yükleme artık manager'a bağlı
        this.textureLoader = new THREE.TextureLoader(); // Dokuları yüklemek için hala gerekli
        this.carGroup = null; // Araç grubunu referans olarak sakla
        this.model = null; // Model referansını sakla
        this.wheels = []; // Tekerlekleri referans olarak sakla
        this.wheelRotation = 0; // Tekerlek dönüş açısı
        
        // Model yönetim sistemi
        this.models = []; // Tüm modelleri sakla
        this.currentModelIndex = 0; // Şu anki model indeksi
        this.modelConfigs = [
            {
                name: 'Formula 1',
                path: './model.glb',
                description: 'Formula 1 Yarış Aracı'
            },
            // Gelecekte daha fazla model ekleyebiliriz
            // {
            //     name: 'Spor Araba',
            //     path: './sport_car.glb',
            //     description: 'Spor Araba Modeli'
            // }
        ];
        
        this.init();
        
        // Start loading processes
        this.setupEnvironment();
        this.loadCurrentModel();
        this.setupModelControls();
        
        // Remove this.animate() call - it will be called by manager.onLoad
    }

    init() {
        const viewer = document.getElementById('viewer');
        const width = viewer ? viewer.clientWidth : window.innerWidth;
        const height = viewer ? viewer.clientHeight : window.innerHeight;
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; 

        this.renderer.outputEncoding = THREE.sRGBEncoding; 
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping; 
        this.renderer.toneMappingExposure = 1.0;
        
        if (viewer) {
            viewer.appendChild(this.renderer.domElement);
        } else {
            document.body.appendChild(this.renderer.domElement);
        }


        this.camera.position.set(0, 2, 8);
        this.camera.lookAt(0, 1, 0);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 1, 0);
        
        // Scroll ile öne-arkaya hareket
        this.controls.enableZoom = false; // Zoom'u kapat
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        };

        this.setupLights();
        this.addGroundWithTexture(); // YENİ ZEMİN FONKSİYONU ÇAĞRILDI
        this.setupSidebarToggle();
        this.setupScrollMovement();
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLights() {
        // Işıklandırma ayarları önceki revizyondan alındı
        const ambientLight = new THREE.AmbientLight(0xffffff, 4.0); 
        this.scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 2.0); 
        this.scene.add(hemiLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 5.0); 
        keyLight.position.set(5, 10, 5); 
        keyLight.castShadow = true;

        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        const d = 10;
        keyLight.shadow.camera.left = -d;
        keyLight.shadow.camera.right = d;
        keyLight.shadow.camera.top = d;
        keyLight.shadow.camera.bottom = -d;
        keyLight.shadow.camera.near = 0.1;
        keyLight.shadow.camera.far = 30;
        this.scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 2.5);
        fillLight.position.set(-10, 5, 5); 
        this.scene.add(fillLight);
    }

    setupEnvironment() {
        const envMapPath = './map.hdr';

        this.rgbeLoader.load(envMapPath, (texture) => {
            const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
            pmremGenerator.compileEquirectangularShader();
            
            const envMap = pmremGenerator.fromEquirectangular(texture).texture;

            this.scene.background = envMap;
            this.scene.environment = envMap;

            texture.dispose();
            pmremGenerator.dispose();
            console.log('HDR çevre haritası başarıyla yüklendi!');
        },
        undefined,
        (err) => {
            console.warn('HDR çevre haritası yüklenemedi, varsayılan ışıklandırma kullanılıyor:', err);
            // HDR yüklenemezse varsayılan ışıklandırmayı kullan
            this.setupDefaultEnvironment();
        });
    }

    setupDefaultEnvironment() {
        // HDR yoksa varsayılan çevre ışıklandırması
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        
        // Basit gradient çevre haritası oluştur
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size * 2;
        canvas.height = size;
        const context = canvas.getContext('2d');
        
        const gradient = context.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, '#87CEEB'); // Açık mavi (gökyüzü)
        gradient.addColorStop(1, '#E0E0E0'); // Açık gri (yer)
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, size * 2, size);
        
        const texture = new THREE.CanvasTexture(canvas);
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        
        this.scene.background = envMap;
        this.scene.environment = envMap;
        
        texture.dispose();
        pmremGenerator.dispose();
        
        console.log('Varsayılan çevre ışıklandırması uygulandı');
    }

    setupSidebarToggle() {
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
            });
        }
    }

    setupModelControls() {
        // Model değiştirme kontrollerini ekle
        this.addModelButtons();
        this.setupKeyboardControls();
    }

    addModelButtons() {
        // Sidebar'a model değiştirme butonları ekle
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            // Mevcut menü öğelerini temizle
            sidebar.innerHTML = '';
            
            // Model seçimi için başlık
            const modelTitle = document.createElement('div');
            modelTitle.className = 'menu-item';
            modelTitle.style.fontWeight = 'bold';
            modelTitle.style.borderBottom = '2px solid #333';
            modelTitle.textContent = 'Model Seçimi';
            sidebar.appendChild(modelTitle);
            
            // Her model için buton oluştur
            this.modelConfigs.forEach((config, index) => {
                const button = document.createElement('a');
                button.href = '#';
                button.className = 'menu-item';
                if (index === this.currentModelIndex) {
                    button.classList.add('active');
                }
                button.textContent = config.name;
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.switchToModel(index);
                });
                sidebar.appendChild(button);
            });
            
            // Diğer menü öğeleri
            const otherItems = [
                { text: 'Görünümü Sıfırla', action: () => this.resetView() },
                { text: 'Wireframe Aç/Kapat', action: () => this.toggleWireframe() },
                { text: 'Modeli Sıfırla', action: () => this.resetModel() },
                { text: 'Ayarlar', action: () => console.log('Ayarlar') },
                { text: 'Yardım', action: () => console.log('Yardım') }
            ];
            
            otherItems.forEach(item => {
                const menuItem = document.createElement('a');
                menuItem.href = '#';
                menuItem.className = 'menu-item';
                menuItem.textContent = item.text;
                menuItem.addEventListener('click', (e) => {
                    e.preventDefault();
                    item.action();
                });
                sidebar.appendChild(menuItem);
            });
        }
    }

    setupKeyboardControls() {
        // Klavye kontrolleri ekle
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowLeft':
                    this.previousModel();
                    break;
                case 'ArrowRight':
                    this.nextModel();
                    break;
                case 'r':
                case 'R':
                    this.resetView();
                    break;
            }
        });
    }

    setupScrollMovement() {
        let scrollDelta = 0;
        const scrollSpeed = 0.5;
        let lastScrollTime = 0;
        
        this.renderer.domElement.addEventListener('wheel', (event) => {
            event.preventDefault();
            
            console.log('Scroll event algılandı:', {
                deltaY: event.deltaY,
                carGroup: !!this.carGroup,
                wheelsCount: this.wheels.length
            });
            
            const currentTime = Date.now();
            const deltaTime = currentTime - lastScrollTime;
            lastScrollTime = currentTime;
            
            // Scroll yönüne göre modeli hareket ettir
            if (event.deltaY > 0) {
                // Aşağı scroll - modeli arkaya hareket ettir
                scrollDelta += scrollSpeed;
            } else {
                // Yukarı scroll - modeli öne hareket ettir
                scrollDelta -= scrollSpeed;
            }
            
            // Modeli hareket ettir - araç 90 derece döndürüldüğü için X ekseni boyunca hareket etmeli
            if (this.model) {
                this.model.position.x = scrollDelta;
                console.log('Model hareket ettirildi, X pozisyonu:', scrollDelta);
                
                // Tekerlekleri döndür
                this.rotateWheels(event.deltaY, deltaTime);
            } else {
                console.log('Model bulunamadı!');
            }
        });
    }
    
    rotateWheels(scrollDirection, deltaTime) {
        console.log('Tekerlek dönüşü çağrıldı:', {
            scrollDirection: scrollDirection,
            wheelsCount: this.wheels.length,
            wheels: this.wheels
        });
        
        // Scroll yönüne göre tekerlek dönüş yönünü belirle
        const rotationDirection = scrollDirection > 0 ? 1 : -1;
        const rotationSpeed = 0.3 * rotationDirection; // Dönüş hızını daha da artırdım
        
        // Sadece tekerlekleri döndür, gövdeyi değil
        this.wheels.forEach((wheel, index) => {
            if (wheel && wheel.isMesh) {
                // Sadece X ekseni etrafında döndür (tekerlek dönüşü)
                wheel.rotation.x += rotationSpeed;
                console.log(`Tekerlek ${index + 1} (${wheel.name}) döndürüldü:`, {
                    name: wheel.name,
                    rotation: wheel.rotation,
                    position: wheel.position
                });
            }
        });
    }
    
    
    
    addGroundWithTexture() {
        // Zemin dokusu olmadan basit zemin oluştur
        const groundSize = 20; // Zemin boyutu
        const geometry = new THREE.PlaneGeometry(groundSize, groundSize);
        
        // Basit gri zemin materyali (görünmez)
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            transparent: true,
            opacity: 0.0, // Tamamen şeffaf
            side: THREE.FrontSide
        });
        
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2; // Yatay zemin
        ground.position.y = -0.01; // Modelin altında
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        console.log('Zemin eklendi (görünmez)');
    }


    loadCurrentModel() {
        const currentConfig = this.modelConfigs[this.currentModelIndex];
        this.loadModel(currentConfig.path);
    }

    loadModel(modelPath) {
        
        this.loader.load(
            modelPath,
            (gltf) => {
                const model = gltf.scene;
                this.model = model; // Model referansını sakla
                
                // Model doğrudan sahneye ekleniyor

                // Tekerlekleri bul ve sakla
                this.wheels = [];
                console.log('Tüm objeler listeleniyor:');
                
                model.traverse((child) => {
                    if (child.isMesh) {
                        console.log('Mesh bulundu:', {
                            name: child.name,
                            position: child.position,
                            rotation: child.rotation,
                            scale: child.scale
                        });
                        
                        child.castShadow = true;
                        child.receiveShadow = true;
                        child.material.needsUpdate = true;
                        
                        // Tekerlek tespiti - sadece isim kontrolü
                        const name = child.name ? child.name.toLowerCase() : '';
                        if (name.includes('wheel') || name.includes('tekerlek') || name.includes('tire')) {
                            this.wheels.push(child);
                            console.log('✅ Tekerlek bulundu:', child.name);
                        } else {
                            console.log('❌ Tekerlek değil:', child.name);
                            
                            // Araç gövdesi için dönüşü sabitle
                            if (name.includes('body') || name.includes('baked')) {
                                console.log('🔒 Araç gövdesi dönüşü sabitlendi:', child.name);
                                // Dönüşü sıfırla ve sabitle
                                child.rotation.set(0, 0, 0);
                                child.userData.lockedRotation = true;
                            }
                        }
                        
                        // Malzeme ayarları
                        if (child.material) {
                            child.material.envMapIntensity = 0.3;
                            child.material.needsUpdate = true;
                        }
                    }
                });

                // Modelin ölçeklendirme ve konumlandırma
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 4 / maxDim;

                model.scale.multiplyScalar(scale);
                box.setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                
                model.position.x += (model.position.x - center.x);
                model.position.y += (model.position.y - center.y) + size.y / 2;
                model.position.z += (model.position.z - center.z);
                
                model.rotation.y = THREE.MathUtils.degToRad(90);

                this.scene.add(model);
                
                const targetY = size.y / 1; 
                const distance = 3; 

                this.camera.position.set(
                    distance * 1.5,
                    targetY + 1.0,
                    distance * 0.5
                );
                
                this.controls.target.set(0, targetY, 0);
                this.controls.update();

                console.log('Model başarıyla yüklendi!');
                console.log('Tespit edilen tekerlek sayısı:', this.wheels.length);
                
            },
            (progress) => {
                console.log('Yükleme: %' + (progress.loaded / progress.total * 100).toFixed(2));
            },
            (error) => {
                console.error('Model yüklenemedi:', error);
                alert('Model yüklenemedi! Dosya yolunu kontrol edin.');
            }
        );
    }


    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        
        // Araç gövdesinin dönüşünü engelle
        this.scene.traverse((child) => {
            if (child.isMesh && child.userData.lockedRotation) {
                child.rotation.set(0, 0, 0);
            }
        });
        
        // Tekerlekleri sürekli döndür (isteğe bağlı)
        this.updateWheelRotation();
        
        this.renderer.render(this.scene, this.camera);
    }
    
    updateWheelRotation() {
        // Bu fonksiyon şu an kullanılmıyor, tekerlek dönüşü scroll sırasında yapılıyor
        // İleride sürekli dönüş isterseniz bu fonksiyonu aktif edebilirsiniz
    }

    onWindowResize() {
        const viewer = document.getElementById('viewer');
        const width = viewer ? viewer.clientWidth : window.innerWidth;
        const height = viewer ? viewer.clientHeight : window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    // Model değiştirme fonksiyonları
    switchToModel(index) {
        if (index >= 0 && index < this.modelConfigs.length) {
            this.currentModelIndex = index;
            this.removeCurrentModel();
            this.loadCurrentModel();
            this.updateModelButtons();
            console.log(`Model değiştirildi: ${this.modelConfigs[index].name}`);
        }
    }

    nextModel() {
        const nextIndex = (this.currentModelIndex + 1) % this.modelConfigs.length;
        this.switchToModel(nextIndex);
    }

    previousModel() {
        const prevIndex = this.currentModelIndex === 0 ? this.modelConfigs.length - 1 : this.currentModelIndex - 1;
        this.switchToModel(prevIndex);
    }

    removeCurrentModel() {
        if (this.model) {
            this.scene.remove(this.model);
            this.model = null;
            this.wheels = [];
        }
    }

    updateModelButtons() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            const buttons = sidebar.querySelectorAll('.menu-item');
            buttons.forEach((button, index) => {
                if (index > 0 && index <= this.modelConfigs.length) { // İlk öğe başlık
                    button.classList.toggle('active', index - 1 === this.currentModelIndex);
                }
            });
        }
    }

    resetView() {
        this.camera.position.set(0, 2, 8);
        this.camera.lookAt(0, 1, 0);
        this.controls.target.set(0, 1, 0);
        this.controls.update();
        console.log('Görünüm sıfırlandı');
    }

    toggleWireframe() {
        if (this.model) {
            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.material.wireframe = !child.material.wireframe;
                }
            });
            console.log('Wireframe değiştirildi');
        }
    }

    resetModel() {
        if (this.model) {
            this.model.position.set(0, 0, 0);
            this.model.rotation.set(0, 0, 0);
            console.log('Model pozisyonu sıfırlandı');
        }
    }
}

// Başlat
const modelViewer = new ModelViewer();
