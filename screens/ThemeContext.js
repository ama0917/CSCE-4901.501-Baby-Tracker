

import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, Baby, Heart, Calendar, Clock, Users, Eye, EyeOff } from 'lucide-react';

// Welcome Screen Component
const WelcomeScreen = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const slides = [
    {
      icon: <Baby className="w-20 h-20 text-pink-400" />,
      title: "Welcome to Baby Tracker",
      subtitle: "Your journey begins here",
      description: "Track every precious moment of your little one's growth and development with ease."
    },
    {
      icon: <Heart className="w-20 h-20 text-rose-400" />,
      title: "Monitor with Love",
      subtitle: "Care made simple",
      description: "Record feedings, sleep patterns, diaper changes, and milestones all in one place."
    },
    {
      icon: <Calendar className="w-20 h-20 text-purple-400" />,
      title: "Track Progress",
      subtitle: "Watch them grow",
      description: "Beautiful charts and insights help you understand your baby's patterns and growth."
    },
    {
      icon: <Users className="w-20 h-20 text-blue-400" />,
      title: "Share & Connect",
      subtitle: "Family moments together",
      description: "Share updates with family members and keep everyone connected to your baby's journey."
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => {
        if (prev === slides.length - 1) {
          // Last slide reached, start completion sequence
          setTimeout(() => {
            setIsVisible(false);
            setTimeout(onComplete, 500);
          }, 2000);
          return prev;
        }
        return prev + 1;
      });
    }, 3000);

    return () => clearInterval(timer);
  }, [slides.length, onComplete]);

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(onComplete, 500);
  };

  return (
    <div className={`fixed inset-0 z-50 bg-gradient-to-br from-cyan-100 via-blue-100 to-pink-100 flex items-center justify-center transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="relative w-full max-w-md mx-4">
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors z-10"
        >
          Skip
        </button>

        {/* Slide content */}
        <div className="text-center px-8">
          {slides.map((slide, index) => (
            <div
              key={index}
              className={`transition-all duration-700 transform ${
                index === currentSlide 
                  ? 'opacity-100 translate-y-0 scale-100' 
                  : index < currentSlide 
                    ? 'opacity-0 -translate-y-8 scale-95' 
                    : 'opacity-0 translate-y-8 scale-95'
              } ${index === currentSlide ? 'block' : 'hidden'}`}
            >
              <div className="mb-8 flex justify-center">
                <div className="animate-bounce">
                  {slide.icon}
                </div>
              </div>
              
              <h1 className="text-3xl font-bold text-gray-800 mb-2 animate-fade-in">
                {slide.title}
              </h1>
              
              <p className="text-lg text-pink-500 font-medium mb-6 animate-fade-in-delayed">
                {slide.subtitle}
              </p>
              
              <p className="text-gray-600 leading-relaxed animate-fade-in-delayed-2">
                {slide.description}
              </p>
            </div>
          ))}
        </div>

        {/* Progress indicators */}
        <div className="flex justify-center mt-12 space-x-2">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentSlide 
                  ? 'w-8 bg-pink-400' 
                  : index < currentSlide 
                    ? 'w-2 bg-pink-300' 
                    : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Floating elements */}
        <div className="absolute -top-10 -left-4 w-6 h-6 bg-pink-200 rounded-full animate-float opacity-60"></div>
        <div className="absolute top-20 -right-2 w-4 h-4 bg-blue-200 rounded-full animate-float-delayed opacity-60"></div>
        <div className="absolute -bottom-8 left-8 w-5 h-5 bg-purple-200 rounded-full animate-float-delayed-2 opacity-60"></div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(180deg); }
        }
        
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0px); }
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float 3s ease-in-out infinite 1s;
        }
        
        .animate-float-delayed-2 {
          animation: float 3s ease-in-out infinite 2s;
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }
        
        .animate-fade-in-delayed {
          animation: fade-in 0.6s ease-out 0.3s both;
        }
        
        .animate-fade-in-delayed-2 {
          animation: fade-in 0.6s ease-out 0.6s both;
        }
      `}</style>
    </div>
  );
};