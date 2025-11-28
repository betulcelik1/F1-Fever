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
        
        // LoadingManager
        this.manager = new THREE.LoadingManager();
        this.manager.onLoad = () => {
            console.log('Tüm varlıklar yüklendi! Animasyon başlıyor.');
            this.animate(); 
        };
        this.manager.onError = (url) => {
            console.error('Şu varlık yüklenirken hata oluştu: ' + url);
        };
        
        // Loaders
        this.loader = new GLTFLoader(this.manager);
        this.rgbeLoader = new RGBELoader(this.manager);
        this.textureLoader = new THREE.TextureLoader();
        
        // Model referansları
        this.carGroup = null; 
        this.model = null; 
        this.wheels = []; 
        this.wheelRotation = 0;
        
        // Model yönetim sistemi
        this.models = []; 
        this.currentModelIndex = 0; 
        this.modelConfigs = [
            {
                name: 'Formula 1',
                path: './model.glb',
                description: 'Formula 1 Yarış Aracı'
            },
        ];

        // --- YENİ: Teams Sayfası (Carousel) için Değişkenler ---
        this.viewerElement = document.getElementById('viewer');
        this.teamsPageElement = document.getElementById('teams-page-container');
        this.teamsGridElement = document.querySelector('.teams-grid'); // Kayan şerit
        
        // Dinamik kart ID'leri
        this.teamCards = [
            document.getElementById('team-card-1'),
            document.getElementById('team-card-2'),
            document.getElementById('team-card-3'), 
            document.getElementById('team-card-4')  
        ];
        
        // Kart konteynerlarını da alıyoruz (ölçekleme için)
        this.teamCardContainers = [
             document.getElementById('team-container-1'),
             document.getElementById('team-container-2'),
             document.getElementById('team-container-3'),
             document.getElementById('team-container-4')
        ];
        
        // Carousel durumu
        this.currentTeamIndex = 0; // Hangi kartın merkezde olduğunu takip et
        this.isTeamScrolling = false; // Scroll "debounce" (hızlı kaydırmayı engelleme) için
        
        // Sidebar buton referansları
        this.teamsSidebarButton = null;
        this.modelSidebarButtons = [];
        
        this.init();
        
        // Yükleme işlemlerini başlat
        this.setupEnvironment();
        this.loadCurrentModel();
        this.setupModelControls();
    }

    init() {
        if (!this.viewerElement) {
            console.error('HATA: "viewer" ID\'li element bulunamadı!');
            return;
        }

        const width = this.viewerElement.clientWidth;
        const height = this.viewerElement.clientHeight;
        
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
        this.renderer.outputEncoding = THREE.sRGBEncoding; 
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping; 
        this.renderer.toneMappingExposure = 1.0;
        
        this.viewerElement.appendChild(this.renderer.domElement);

        this.camera.position.set(0, 2, 8);
        this.camera.lookAt(0, 1, 0);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 1, 0);
        this.controls.enableZoom = true; 
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        };

        this.setupLights();
        this.addGroundWithTexture();
        this.setupSidebarToggle();
        
        // Scroll hareketlerini ayır
        this.setupModelScrollMovement(); // Model için scroll
        
        // DEĞİŞTİ: Teams sayfası scroll mantığı tamamen değişti
        this.setupTeamsPageScroll();     
        
        // YENİ: Kartlara tıklama (döndürme) özelliği ekle
        this.setupTeamCardClickListeners();
        
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Başlangıçta 3D Görüntüleyiciyi göster
        this.showViewerPage();
    }
    
    // 3D Görüntüleyici sayfasını göster
    showViewerPage() {
        if (this.viewerElement) this.viewerElement.style.display = 'block';
        if (this.teamsPageElement) this.teamsPageElement.style.display = 'none';
        
        // Aktif butonları güncelle
        this.modelSidebarButtons.forEach((btn, index) => {
            btn.classList.toggle('active', index === this.currentModelIndex);
        });
        if (this.teamsSidebarButton) this.teamsSidebarButton.classList.remove('active');
    }
    
    // Teams sayfasını göster
    showTeamsPage() {
        if (this.viewerElement) this.viewerElement.style.display = 'none';
        if (this.teamsPageElement) this.teamsPageElement.style.display = 'block';
        
        // Aktif butonları güncelle
        this.modelSidebarButtons.forEach(btn => btn.classList.remove('active'));
        if (this.teamsSidebarButton) this.teamsSidebarButton.classList.add('active');
        
        // YENİ: Teams sayfası gösterildiğinde kartların pozisyonunu hesapla
        this.updateTeamCardStates();
    }

    setupLights() {
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
        },
        undefined,
        (err) => {
            console.warn('HDR çevre haritası yüklenemedi, varsayılan ışıklandırma kullanılıyor:', err);
            this.setupDefaultEnvironment();
        });
    }
    setupDefaultEnvironment() {
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size * 2;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const gradient = context.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#E0E0E0');
        context.fillStyle = gradient;
        context.fillRect(0, 0, size * 2, size);
        const texture = new THREE.CanvasTexture(canvas);
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        this.scene.background = envMap;
        this.scene.environment = envMap;
        texture.dispose();
        pmremGenerator.dispose();
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
        this.addModelButtons(); 
        this.setupKeyboardControls();
    }
    addModelButtons() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.innerHTML = ''; 
            this.modelSidebarButtons = []; 
            
            const modelTitle = document.createElement('div');
            modelTitle.className = 'menu-item';
            modelTitle.style.fontWeight = 'bold';
            modelTitle.style.borderBottom = '2px solid #333';
            modelTitle.textContent = 'Model Seçimi';
            sidebar.appendChild(modelTitle);
            
            this.modelConfigs.forEach((config, index) => {
                const button = document.createElement('a');
                button.href = '#';
                button.className = 'menu-item model-button'; 
                
                button.textContent = config.name;
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.switchToModel(index);
                    this.showViewerPage(); 
                });
                sidebar.appendChild(button);
                this.modelSidebarButtons.push(button); 
            });

            if (this.modelSidebarButtons[this.currentModelIndex]) {
                 this.modelSidebarButtons[this.currentModelIndex].classList.add('active');
            }
            
            this.teamsSidebarButton = document.createElement('a');
            this.teamsSidebarButton.href = '#';
            this.teamsSidebarButton.className = 'menu-item teams-button'; 
            this.teamsSidebarButton.textContent = 'Teams'; 
            this.teamsSidebarButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.showTeamsPage(); 
            });
            sidebar.appendChild(this.teamsSidebarButton);
            
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
                    if (this.viewerElement.style.display === 'block') {
                        item.action();
                    } else {
                        console.warn('Bu işlem sadece 3D Model Görüntüleyicide aktiftir.');
                    }
                });
                sidebar.appendChild(menuItem);
            });
        }
    }
    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            if (this.viewerElement.style.display !== 'block') return;
            
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
    setupModelScrollMovement() {
        let scrollDelta = 0;
        const scrollSpeed = 0.5;
        let lastScrollTime = 0;
        
        this.renderer.domElement.addEventListener('wheel', (event) => {
            if (this.teamsPageElement && this.teamsPageElement.style.display === 'block') {
                return;
            }
            
            event.preventDefault();
            
            const currentTime = Date.now();
            const deltaTime = currentTime - lastScrollTime;
            lastScrollTime = currentTime;
            
            if (event.deltaY > 0) {
                scrollDelta += scrollSpeed;
            } else {
                scrollDelta -= scrollSpeed;
            }
            
            if (this.model) {
                this.model.position.x = scrollDelta;
                this.rotateWheels(event.deltaY, deltaTime);
            }
        }, { passive: false }); 
    }
    rotateWheels(scrollDirection, deltaTime) {
        const rotationDirection = scrollDirection > 0 ? 1 : -1;
        const rotationSpeed = 0.3 * rotationDirection; 
        
        this.wheels.forEach((wheel) => {
            if (wheel && wheel.isMesh) {
                wheel.rotation.x += rotationSpeed;
            }
        });
    }
    
    
    // DEĞİŞTİ: Teams sayfası scroll mantığı (Yatay Carousel)
    setupTeamsPageScroll() {
        if (!this.teamsPageElement) {
            console.warn('Teams sayfası elementi (teams-page-container) bulunamadı.');
            return;
        }

        // Teams sayfası kapsayıcısını dinle
        this.teamsPageElement.addEventListener('wheel', (event) => {
            event.preventDefault(); // Dikey kaydırmayı ve sayfa yenilemeyi engelle
            
            // Eğer animasyon devam ediyorsa yeni scroll'u yoksay (Debounce)
            if (this.isTeamScrolling) return; 
            
            this.isTeamScrolling = true;
            // CSS transition süresiyle (800ms) eşleşen bir bekleme süresi
            setTimeout(() => { this.isTeamScrolling = false; }, 800); 

            if (event.deltaY > 0) {
                // Scroll aşağı -> sonraki kart
                this.currentTeamIndex++;
            } else {
                // Scroll yukarı -> önceki kart
                this.currentTeamIndex--;
            }

            // Index'i sınırlar içinde tut
            if (this.currentTeamIndex < 0) {
                this.currentTeamIndex = 0;
            }
            if (this.currentTeamIndex >= this.teamCards.length) {
                this.currentTeamIndex = this.teamCards.length - 1;
            }

            // Kartların pozisyonunu ve durumunu güncelle
            this.updateTeamCardStates();
            
        }, { passive: false }); // preventDefault için
    }

    // YENİ: Kartlara tıklama (döndürme) özelliği
    setupTeamCardClickListeners() {
        this.teamCardContainers.forEach((container, index) => {
            if (container) {
                container.addEventListener('click', () => {
                    // Sadece aktif (merkezdeki) kartın dönmesine izin ver
                    if (index === this.currentTeamIndex) {
                        // 'is-flipped' sınıfını .team-card elementine ekle/kaldır
                        this.teamCards[index].classList.toggle('is-flipped');
                    } else {
                        // Eğer aktif olmayan bir karta tıklandıysa, o kartı merkeze getir
                        this.currentTeamIndex = index;
                        this.updateTeamCardStates();
                    }
                });
            }
        });
    }
    
    // YENİ: Kartların pozisyonunu (translateX) ve durumunu (inactive) güncelleyen fonksiyon
    updateTeamCardStates() {
        if (!this.teamsGridElement || !this.teamCardContainers.length) return;

        // 1. Gerekli pozisyonu (TranslateX) hesapla
        const cardElement = this.teamCardContainers[this.currentTeamIndex];
        if (!cardElement) return;
        
        const cardWidth = cardElement.offsetWidth;
        // CSS'teki margin (0 25px) ile eşleşmeli
        const cardMargin = 25; 
        const cardTotalWidth = cardWidth + (cardMargin * 2);
        
        // Kartı ortalamak için gereken pozisyon:
        // (Ekran genişliği / 2) - (Kart genişliği / 2)
        const centerOffset = (this.teamsPageElement.clientWidth / 2) - (cardWidth / 2);
        
        // Hedef X pozisyonu:
        // Ortalanmış pozisyon - (önceki kartların toplam genişliği)
        const targetTranslateX = centerOffset - (this.currentTeamIndex * cardTotalWidth);
        
        // teams-grid elementinin pozisyonunu CSS transition ile güncelle
        this.teamsGridElement.style.transform = `translateX(${targetTranslateX}px)`;

        // 2. Aktif/İnaktif sınıflarını güncelle (küçültme/soluklaştırma)
        this.teamCardContainers.forEach((container, index) => {
            if (container) {
                if (index === this.currentTeamIndex) {
                    // Bu aktif kart
                    container.classList.remove('inactive');
                } else {
                    // Bunlar yandaki (inaktif) kartlar
                    container.classList.add('inactive');
                    // Yandan geçerken dönük kart varsa düzelt
                    this.teamCards[index].classList.remove('is-flipped'); 
                }
            }
        });
    }


    addGroundWithTexture() {
        const groundSize = 20;
        const geometry = new THREE.PlaneGeometry(groundSize, groundSize);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            transparent: true,
            opacity: 0.0, 
            side: THREE.FrontSide
        });
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01;
        ground.receiveShadow = true;
        this.scene.add(ground);
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
                this.model = model; 
                this.wheels = [];
                
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        child.material.needsUpdate = true;
                        
                        const name = child.name ? child.name.toLowerCase() : '';
                        if (name.includes('wheel') || name.includes('tekerlek') || name.includes('tire')) {
                            this.wheels.push(child);
                        } else {
                            if (name.includes('body') || name.includes('baked')) {
                                child.rotation.set(0, 0, 0);
                                child.userData.lockedRotation = true;
                            }
                        }
                        
                        if (child.material) {
                            child.material.envMapIntensity = 0.3;
                            child.material.needsUpdate = true;
                        }
                    }
                });

                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 4 / maxDim;

                model.scale.multiplyScalar(scale);
                box.setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                
                model.position.x += (model.position.x - center.x);
                model.position.y += (model.position.y - center.y);
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
            },
            (progress) => {
                console.log('Yükleme: %' + (progress.loaded / progress.total * 100).toFixed(2));
            },
            (error) => {
                console.error('Model yüklenemedi:', error);
            }
        );
    }

    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // 3D Görüntüleyici render'ı
        if (this.viewerElement && this.viewerElement.style.display === 'block') {
            this.controls.update();
            
            this.scene.traverse((child) => {
                if (child.isMesh && child.userData.lockedRotation) {
                    child.rotation.set(0, 0, 0);
                }
            });
            
            this.renderer.render(this.scene, this.camera);
        }

        // Teams sayfası animasyonu artık CSS transition'ları tarafından yönetiliyor.
        // Bu nedenle 'animate' içinde özel bir kod gerekmiyor.
    }
    

    onWindowResize() {
        if (this.viewerElement && this.viewerElement.style.display === 'block') {
            const width = this.viewerElement.clientWidth;
            const height = this.viewerElement.clientHeight;
            
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
        
        // YENİ: Ekran yeniden boyutlandırıldığında carousel'in ortalamasını güncelle
        if (this.teamsPageElement && this.teamsPageElement.style.display === 'block') {
             this.updateTeamCardStates();
        }
    }

    switchToModel(index) {
        if (index >= 0 && index < this.modelConfigs.length) {
            this.currentModelIndex = index;
            this.removeCurrentModel();
            this.loadCurrentModel();
            this.updateModelButtonsActiveState(); 
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
    updateModelButtonsActiveState() {
        this.modelSidebarButtons.forEach((button, index) => {
            button.classList.toggle('active', index === this.currentModelIndex);
        });
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
            this.removeCurrentModel();
            this.loadCurrentModel();
            console.log('Model pozisyonu sıfırlandı');
        }
    }
}

// Başlat
const modelViewer = new ModelViewer();

