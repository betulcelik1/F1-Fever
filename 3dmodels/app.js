import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class ModelViewer {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = null;
        this.loader = new GLTFLoader();
        this.textureLoader = new THREE.TextureLoader(); // Dokuları yüklemek için hala gerekli
        
        this.init();
        this.loadModel();
        this.animate();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0xcccccc); // Arka plan rengi (Tekrar görünür oldu)
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; 

        // Renk Yönetimi Ayarları
        this.renderer.outputEncoding = THREE.sRGBEncoding; 
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping; 
        this.renderer.toneMappingExposure = 1.0; // Sayfa parlaklığını normale indirdim.
        
        document.body.appendChild(this.renderer.domElement);

        // *** ARKA PLAN RESMİ YÜKLEME KALDIRILDI ***
        // this.textureLoader.load(backgroundPath, ...); // Bu kısım silindi.
        this.scene.background = new THREE.Color(0xcccccc); // Sahne arka planı varsayılan renk

        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 0, 0);

        this.setupLights();
        this.addGroundWithTexture(); // YENİ ZEMİN FONKSİYONU ÇAĞRILDI
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
    
    // ZEMİN FOTOĞRAFI EKLEME FONKSİYONU
    addGroundWithTexture() {
        // *** DOKU YOLUNUZU BURAYA GİRİN! ***
        const groundTexturePath = './textures/your_ground_image.jpg'; 
        
        this.textureLoader.load(groundTexturePath, 
            (texture) => {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                // Fotoğrafın zeminde ne kadar tekrar edeceğini belirleyin. Tekrar etmesini istemiyorsanız (1, 1) yapın.
                texture.repeat.set(1, 1); 
                texture.encoding = THREE.sRGBEncoding; // Renkleri doğru göstermek için

                // Zeminin modelden daha geniş olması için boyutları ayarlayın
                const groundSize = 10; // Model ölçeğine göre zeminin boyutu

                const geometry = new THREE.PlaneGeometry(groundSize, groundSize); 
                
                const material = new THREE.MeshStandardMaterial({ 
                    map: texture, 
                    side: THREE.FrontSide, // Arka tarafı görmek istemediğimiz için
                    roughness: 0.8, // Parlamayı azalt
                    metalness: 0.1
                });
                
                const ground = new THREE.Mesh(geometry, material);
                ground.rotation.x = -Math.PI / 2; 
                ground.position.y = -0.01; // Zeminin modelin altına yerleşimi
                ground.receiveShadow = true;
                this.scene.add(ground);
            },
            undefined, 
            (err) => {
                console.error('Zemin dokusu yüklenemedi:', err);
                // Hata durumunda varsayılan gri zemin
                const geometry = new THREE.PlaneGeometry(10, 10);
                const material = new THREE.MeshStandardMaterial({ color: 0x444444 });
                const ground = new THREE.Mesh(geometry, material);
                ground.rotation.x = -Math.PI / 2;
                ground.position.y = 0;
                ground.receiveShadow = true;
                this.scene.add(ground);
            }
        );
    }

    loadModel() {
        const modelPath = './model.glb';
        
        this.loader.load(
            modelPath,
            (gltf) => {
                const model = gltf.scene;
                this.scene.add(model);

                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        child.material.needsUpdate = true;
                    }
                });

                // Modelin ortalanması ve ölçeklendirilmesi
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);

                // Zemin eklendiği için Y'yi düzgün ayarlayalım
                model.position.sub(center).add(new THREE.Vector3(0, size.y / 2, 0)); 
                const scale = 5 / maxDim;
                model.scale.multiplyScalar(scale);
                
                // Kamera Sol Ön Çapraz Açısı
                const distance = 8; 
                const targetY = size.y * scale / 2;

                this.camera.position.set(
                    -distance,   // X: Negatif X (SOL taraf)
                    targetY + 2, // Y: Biraz yukarıdan bak
                    distance     // Z: Arabanın ön/çaprazında kal
                );
                
                this.controls.target.set(0, targetY, 0); // Hedefi arabanın ortasına ayarla
                this.controls.update();

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
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Başlat
new ModelViewer();