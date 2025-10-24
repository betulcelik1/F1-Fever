import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

class ModelViewer {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = null;
        
        // --- ÇÖZÜM 1: LoadingManager Oluştur ---
        // Bu yönetici, tüm yükleyicilerin ne zaman bittiğini takip edecek
        this.manager = new THREE.LoadingManager();
        
        // --- ÇÖZÜM 2: Yükleme Bitince Ne Yapılacağını Söyle ---
        // Tüm yüklemeler (HDR ve GLB) bittiğinde, animasyonu (render'ı) başlat.
        this.manager.onLoad = () => {
            console.log('Tüm varlıklar yüklendi! Animasyon başlıyor.');
            this.animate(); // Render döngüsünü ARTIK başlatabiliriz
        };
        
        this.manager.onError = (url) => {
            console.error('Şu varlık yüklenirken hata oluştu: ' + url);
        };
        // --- ÇÖZÜM BİTTİ ---

        // --- ÇÖZÜM 3: Yükleyicilere Yöneticilerini Tanıt ---
        // Yükleyicileri oluştururken onlara manager'ı ver
        this.loader = new GLTFLoader(this.manager);
        this.rgbeLoader = new RGBELoader(this.manager); // Bunu sınıf özelliği yaptık
        
        this.init();
        
        // Yüklemeleri başlat
        this.setupEnvironment(); 
        this.loadModel();
        
        // this.animate(); // <-- ÇÖZÜM 4: BU SATIRI SİLİYORUZ!
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; 

        this.renderer.outputEncoding = THREE.sRGBEncoding; 
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping; 
        this.renderer.toneMappingExposure = 1.0; 
        
        document.body.appendChild(this.renderer.domElement);

        // setupEnvironment() çağrısı constructor'a taşındı
        // this.setupEnvironment(); // <-- SİLİNDİ

        this.camera.position.set(0, 2, 8);
        this.camera.lookAt(0, 1, 0);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 1, 0);

        this.setupLights();
        
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    setupEnvironment() {
        // const rgbeLoader = new RGBELoader(); // <-- ÇÖZÜM 5: SİL
        const envMapPath = './zwartkops_straight_sunset_4k.hdr';

        // ÇÖZÜM 6: "this.rgbeLoader" kullan (manager'a bağlı olan)
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
            console.error('Çevre haritası (HDR) yüklenemedi:', err);
        });
    }

    setupLights() {
        // Bu fonksiyonda değişiklik yok...
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.0); 
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
    }
    
    loadModel() {
        // Bu fonksiyonda değişiklik yok...
        // "this.loader" zaten manager'a bağlı olduğu için
        // yükleme bittiğinde manager'ın haberi olacak.
        const modelPath = './model.glb';
        
        this.loader.load(
            modelPath,
            (gltf) => {
                const model = gltf.scene;

                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true; 
                    }
                });
                
                // ... (Modelin ölçeklendirme ve konumlandırma kodunun kalanı aynı)
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
                // --- DEĞİŞEN KISMIN SONU ---

                console.log('Model başarıyla yüklendi!');
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
        // Bu fonksiyon ancak her şey yüklendikten sonra çağrılacak
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        // Bu fonksiyonda değişiklik yok...
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Başlat
new ModelViewer();