import React, { useState, useEffect, useRef } from 'react';
import CarViewer from './components/CarViewer';
import BrandSelector from './components/BrandSelector';

const cars = [
  { name: 'Alpine', url: '/models/F1-2025 Alpine A525.glb' },
];

function App() {
  const [activeCarIndex, setActiveCarIndex] = useState(0);
  // TS tipi kaldırıldı:
  const segmentRefs = useRef(new Array(cars.length).fill(null));

  useEffect(() => {
    // Intersection Observer mantığı doğru, JS'de çalışacaktır
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // data-index HTML attributu hala string olarak alınıyor, Number() doğru
            const index = Number(entry.target.getAttribute('data-index'));
            if (index !== -1) {
              setActiveCarIndex(index);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.6
      }
    );

    segmentRefs.current.forEach((ref) => ref && observer.observe(ref));

    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', backgroundColor: '#f0f0f0' }}>
      <h1 style={{ textAlign: 'center', padding: '20px' }}>F1 Fever Demo</h1>
      {/* CarViewer bileşenini buraya aktardığınızdan emin olun */}
      <CarViewer carUrl={cars[activeCarIndex].url} style={{ height: '70vh', width: '100%', position: 'sticky', top: 0, zIndex: 1 }} />
      
      {/* Yatay Kaydırma Alanı */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        width: '100%',
        padding: '20px 0',
      }}>
        {cars.map((car, index) => (
          <div
            key={car.name}
            data-index={index}
            ref={(el) => {
              segmentRefs.current[index] = el;
            }}
            style={{
              flex: '0 0 100%',
              height: 'calc(100vh - 140px)',
              textAlign: 'center',
              scrollSnapAlign: 'center',
              opacity: index === activeCarIndex ? 1 : 0.5,
              transition: 'opacity 0.3s',
            }}
          >
            <h2>{car.name} Segmenti</h2>
            <p>Buraya {car.name} hakkında info ekle.</p>
          </div>
        ))}
      </div>
      
      {/* Marka Seçici */}
      <BrandSelector
        onSelect={(url) => {
          const index = cars.findIndex((car) => car.url === url);
          if (index !== -1) {
            setActiveCarIndex(index);
            // ScrollIntoView doğru bir JS metodudur
            segmentRefs.current[index]?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
          }
        }}
        brands={cars}
      />
    </div>
  );
}

export default App;