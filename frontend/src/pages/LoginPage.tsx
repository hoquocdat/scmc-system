import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Array of images from /public/images
  const images = [
    '/images/1.jpg',
    '/images/2.jpg',
    '/images/3.jpg'
    // Add more images here as they're added to /public/images
  ];

  // Auto-advance slider every 5 seconds
  useEffect(() => {
    if (images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 10000);

    return () => clearInterval(interval);
  }, [images.length]);

  const handleLoginSuccess = () => {
    navigate('/dashboard');
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Clear Image with Login Form Overlay */}
      <div className="flex-1 relative ">
        {/* Clear background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${images[currentImageIndex]})` }}
        />

        {/* Dark overlay for form readability */}
        <div className="absolute inset-0 md:backdrop-blur-3xl bg-slate-900/30" />

        {/* Login Form */}
        <div className="relative z-10 flex items-center justify-center min-h-screen p-4 lg:p-8">
          <div className="w-full max-w-md">
            <LoginForm onSuccess={handleLoginSuccess} />
          </div>
        </div>
      </div>

      {/* Right Side - Blurred Version with Slider Controls */}
      <div className="flex-1 relative hidden lg:block">
        {/* Clear image layer */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-all"
          style={{ backgroundImage: `url(${images[currentImageIndex]})` }}
        />

        {/* Slider Controls */}
        <div className="relative z-10 w-full h-full flex items-center justify-center">
          {/* Navigation buttons */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-8 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white p-3 rounded-full transition-all shadow-lg"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-8 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white p-3 rounded-full transition-all shadow-lg"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Dots indicator */}
          {images.length > 1 && (
            <div className="absolute bottom-8 left-1/2 flex gap-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentImageIndex
                      ? 'bg-white w-8'
                      : 'bg-white/50 hover:bg-white/75 w-2'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
