document.addEventListener("DOMContentLoaded", function () {
    // Error handling for third-party dependencies
    function checkDependencies() {
        const errors = [];
        
        // Check for GSAP
        if (typeof gsap === 'undefined') {
            errors.push('GSAP library is not loaded. Animation effects will be limited.');
        }
        
        // Check for Pixi.js
        if (typeof PIXI === 'undefined') {
            errors.push('Pixi.js library is not loaded. Fog effects will be disabled.');
        }
        
        // Check for Web Audio API support
        if (!window.AudioContext && !window.webkitAudioContext) {
            errors.push('Web Audio API is not supported in this browser. Audio visualization will be disabled.');
        }
        
        return errors;
    }

    // Display error messages to user
    function displayError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            font-family: Arial, sans-serif;
            text-align: center;
            max-width: 80%;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        // Fade out after 5 seconds
        setTimeout(() => {
            errorDiv.style.transition = 'opacity 1s';
            errorDiv.style.opacity = '0';
            setTimeout(() => errorDiv.remove(), 1000);
        }, 5000);
    }

    // Check for dependencies and handle errors
    const dependencyErrors = checkDependencies();
    if (dependencyErrors.length > 0) {
        console.warn('Initialization warnings:', dependencyErrors);
        dependencyErrors.forEach(error => displayError(error));
    }

    // Safely initialize audio context with error handling
    function initializeAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                throw new Error('Web Audio API not supported');
            }
            return new AudioContext();
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            displayError('Failed to initialize audio system. Please try a different browser.');
            return null;
        }
    }

    // Safely create fog effect with error handling
    function createFogEffect(container, width, height) {
        console.log('Attempting to create fog effect...');
        if (typeof PIXI === 'undefined') {
            console.error('Pixi.js not loaded - fog effect disabled');
            displayError('Pixi.js not loaded - visual effects will be limited');
            return null;
        }

        try {
            console.log('PIXI.js version:', PIXI.VERSION);
            console.log('Creating FogEffect with dimensions:', width, height);
            const effect = new FogEffect(container, width, height);
            console.log('Fog effect created successfully');
            return effect;
        } catch (error) {
            console.error('Failed to create fog effect:', error);
            displayError('Failed to initialize visual effects. Performance may be limited.');
            return null;
        }
    }

    const playButton = document.getElementById("playButton");
    const audioPlayer = document.getElementById("audioPlayer");
    const albumCover = document.querySelector(".album-cover");
    const canvas = document.getElementById("distortionCanvas");
    const ctx = canvas.getContext("2d");
    const messages = document.querySelectorAll(".message");
    let isPlaying = false;
    let breakdown = 0;
    let audioContext = null;
    let analyser = null;
    let embers = [];
    let lastAudioData = new Uint8Array(128);

    // Set canvas size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Clock fade out
    const clock = document.querySelector('.clock');
    setTimeout(() => {
        clock.classList.add('fade-out');
    }, 15000);

    // Ember Effect
    class Ember {
        constructor(x, y) {
            this.element = document.createElement('div');
            this.element.className = 'ember';
            this.element.style.position = 'fixed';  // Use fixed positioning
            this.element.style.left = '0';
            this.element.style.top = '0';
            this.element.style.pointerEvents = 'none';
            document.body.appendChild(this.element);
            
            // Store actual coordinates
            this.x = x;
            this.y = y;
            this.initialX = x;
            this.initialY = y;
            this.angle = Math.random() * Math.PI * 2;
            this.velocity = Math.random() * 2 + 1;
            this.life = 1;
            this.decay = Math.random() * 0.02 + 0.02;
            
            // Set initial position
            this.updatePosition();
        }

        updatePosition() {
            this.element.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) scale(${this.life})`;
        }

        update() {
            this.life -= this.decay;
            this.y = this.initialY - (1 - this.life) * 100;
            this.x = this.initialX + Math.sin(this.angle) * 10 * (1 - this.life);

            if (this.life > 0) {
                this.updatePosition();
                this.element.style.opacity = this.life;
                return true;
            } else {
                this.element.remove();
                return false;
            }
        }
    }

    function createEmber(x, y) {
        if (isPlaying && Math.random() < 0.3) {
            embers.push(new Ember(x, y));
        }
    }

    function updateEmbers() {
        embers = embers.filter(ember => ember.update());
        requestAnimationFrame(updateEmbers);
    }
    updateEmbers();

    // Mouse movement for embers and distortion
    document.addEventListener("mousemove", (e) => {
        createEmber(e.clientX, e.clientY);
    });

    // Audio Analysis Setup
    function setupAudioContext() {
        console.log('Setting up audio context...');
        audioContext = initializeAudioContext();
        if (!audioContext) {
            return false;
        }

        try {
            analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaElementSource(audioPlayer);
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.2;
            console.log('Audio context setup complete');
            return true;
        } catch (error) {
            console.error('Failed to setup audio analysis:', error);
            displayError('Failed to setup audio visualization. Some features may be limited.');
            return false;
        }
    }

    // Initialize moving average arrays
    let recentEnergies = Array(10).fill(0);
    let baselineEnergy = 0;
    let peakEnergy = 0;

    // Get frequency band energy with focus on heavy metal characteristics
    function getFrequencyBandEnergy(dataArray, start, end) {
        let sum = 0;
        let peak = 0;
        for (let i = start; i < end; i++) {
            sum += dataArray[i];
            peak = Math.max(peak, dataArray[i]);
        }
        return peak / 255; // Just use peak for faster response
    }

    // Add color cycling variables
    let hueRotation = 0;
    const HUE_ROTATION_SPEED = 0.5;

    // Fog effect using Pixi.js
    class FogEffect {
        constructor(container, width, height) {
            this.container = container;
            this.failureCount = 0;
            this.maxFailures = 3;
            this.useFallbackMode = false;
            
            // Store initial dimensions
            const rect = container.getBoundingClientRect();
            this.width = Math.max(window.innerWidth, 1920);
            this.height = Math.max(window.innerHeight, 1080);
            
            this.createApplication();
        }

        createApplication() {
            try {
                // Create Pixi application with more conservative settings
                this.app = new PIXI.Application({
                    width: this.width,
                    height: this.height,
                    transparent: true,
                    antialias: false,
                    backgroundAlpha: 0,
                    resolution: window.devicePixelRatio || 1,  // Use device pixel ratio for better visibility
                    powerPreference: 'default',  // Use default for better quality
                    autoDensity: true
                });

                // Position the canvas
                this.setupCanvas();
                
                // Initialize properties
                this.initializeProperties();
                
                // Create fog layers
                this.createFogLayers();
                
                // Reset failure count on successful creation
                this.failureCount = 0;
                
            } catch (error) {
                console.error('Failed to create PIXI application:', error);
                this.handleFailure();
            }
        }

        handleFailure() {
            this.failureCount++;
            console.log(`Fog effect failure count: ${this.failureCount}`);
            
            if (this.failureCount >= this.maxFailures) {
                console.log('Switching to fallback mode');
                this.useFallbackMode = true;
                this.cleanup();  // Clean up PIXI resources
                this.setupFallbackMode();
            } else {
                // Try to recreate the application
                setTimeout(() => this.createApplication(), 1000);
            }
        }

        setupFallbackMode() {
            // Create a simple canvas-based fallback
            this.fallbackCanvas = document.createElement('canvas');
            this.fallbackCanvas.style.position = 'fixed';
            this.fallbackCanvas.style.top = '0';
            this.fallbackCanvas.style.left = '0';
            this.fallbackCanvas.style.width = '100%';
            this.fallbackCanvas.style.height = '100%';
            this.fallbackCanvas.style.pointerEvents = 'none';
            this.fallbackCanvas.style.zIndex = '2';
            this.fallbackCanvas.style.opacity = '0.5';
            document.body.appendChild(this.fallbackCanvas);
            
            // Set canvas size
            this.resizeFallbackCanvas();
            
            // Start fallback animation
            this.updateFallback();
        }

        resizeFallbackCanvas() {
            if (this.fallbackCanvas) {
                this.fallbackCanvas.width = window.innerWidth;
                this.fallbackCanvas.height = window.innerHeight;
            }
        }

        updateFallback() {
            if (!this.fallbackCanvas || !this.useFallbackMode) return;
            
            const ctx = this.fallbackCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.fallbackCanvas.width, this.fallbackCanvas.height);
            
            // Simple gradient-based fog effect
            const gradient = ctx.createRadialGradient(
                this.centerX, this.centerY, 0,
                this.centerX, this.centerY, this.glowRadius
            );
            
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, this.fallbackCanvas.width, this.fallbackCanvas.height);
            
            requestAnimationFrame(() => this.updateFallback());
        }

        cleanup() {
            if (this.app) {
                this.app.destroy(true, { children: true, texture: true, baseTexture: true });
                this.app = null;
            }
        }

        setupCanvas() {
            this.app.view.style.position = 'fixed';
            this.app.view.style.top = '0';
            this.app.view.style.left = '0';
            this.app.view.style.width = '100%';
            this.app.view.style.height = '100%';
            this.app.view.style.pointerEvents = 'none';
            this.app.view.style.zIndex = '2';
            this.app.view.style.mixBlendMode = 'screen';  // Changed to screen for better visibility
            document.body.appendChild(this.app.view);
        }

        initializeProperties() {
            const rect = this.container.getBoundingClientRect();
            this.centerX = rect.left + rect.width / 2;
            this.centerY = rect.top + rect.height / 2;
            this.spawnRadius = Math.max(window.innerWidth, window.innerHeight);
            this.glowRadius = Math.max(rect.width, rect.height) * 1.5;

            // Create fog container
            this.fogContainer = new PIXI.Container();
            this.app.stage.addChild(this.fogContainer);
            this.fogLayers = [];
        }

        handleContextLoss() {
            console.log('WebGL context lost - pausing fog effect');
            // Store the current state if needed
            this.contextLost = true;
            // Clear references to prevent memory leaks
            this.fogLayers = [];
            this.fogContainer.removeChildren();
        }

        handleContextRestore() {
            console.log('WebGL context restored - rebuilding fog effect');
            this.contextLost = false;
            // Reinitialize everything
            this.initializeProperties();
            this.createFogLayers();
        }

        createFogLayers() {
            if (this.useFallbackMode) return;

            const layerCount = 4;  // Reduced number of layers
            this.fogLayers = [];
            this.fogContainer = new PIXI.Container();
            this.app.stage.addChild(this.fogContainer);

            for (let i = 0; i < layerCount; i++) {
                const layer = new PIXI.Container();
                this.fogContainer.addChild(layer);
                this.fogLayers.push(layer);
                this.createFogParticlesForLayer(layer, i);
            }
        }

        createFogParticlesForLayer(layer, layerIndex) {
            if (this.useFallbackMode) return;

            const particleCount = 200 - (layerIndex * 25);  // Fewer, but more visible particles
            const baseAlpha = Math.min(0.6, 0.6 - (layerIndex * 0.1));  // Higher base opacity
            const baseScale = 150 + (layerIndex * 50);  // Much larger particles

            for (let i = 0; i < particleCount; i++) {
                try {
                    const sprite = new PIXI.Sprite(this.createFogTexture());
                    this.setupParticle(sprite, baseAlpha, baseScale);
                    layer.addChild(sprite);
                } catch (error) {
                    console.warn('Failed to create particle:', error);
                }
            }
        }

        createFogTexture() {
            const quality = 256;  // Reduced for better performance
            const canvas = document.createElement('canvas');
            canvas.width = quality;
            canvas.height = quality;
            const ctx = canvas.getContext('2d');

            const gradient = ctx.createRadialGradient(
                quality/2, quality/2, 0,
                quality/2, quality/2, quality/2
            );

            // More intense gradient for better visibility
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
            gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.9)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
            gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.2)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, quality, quality);

            return PIXI.Texture.from(canvas);
        }

        setupParticle(sprite, baseAlpha, baseScale) {
            sprite.anchor.set(0.5);
            
            // Initial position - spawn closer to the album
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * this.glowRadius * 2;  // Spawn within glow radius
            sprite.x = this.centerX + Math.cos(angle) * distance;
            sprite.y = this.centerY + Math.sin(angle) * distance;
            
            // Visual properties - more visible
            sprite.alpha = baseAlpha;
            sprite.baseAlpha = baseAlpha;
            
            // Movement properties - slower movement
            sprite.angle = angle;
            sprite.distance = distance;
            sprite.vx = (Math.random() - 0.5) * 0.05;  // Slower movement
            sprite.vy = (Math.random() - 0.5) * 0.05;
            sprite.scale.set((Math.random() * 0.5 + 1) * baseScale);
            sprite.baseScale = sprite.scale.x;
            sprite.rotation = Math.random() * Math.PI * 2;
            sprite.rotationSpeed = (Math.random() - 0.5) * 0.001;
            sprite.oscillationSpeed = Math.random() * 0.002;
            sprite.oscillationAmplitude = Math.random() * 100;
            sprite.time = Math.random() * Math.PI * 2;
        }

        updateParticle(sprite, energy, hue, layerIndex) {
            sprite.time += sprite.oscillationSpeed;
            
            // Slower movement with more pronounced energy effect
            sprite.angle += (0.001 + (energy * 0.002)) * (1 - layerIndex * 0.05);
            const wobble = Math.sin(sprite.time) * sprite.oscillationAmplitude * (energy + 0.5);
            sprite.x += sprite.vx * (1 + energy * 3);  // More responsive to energy
            sprite.y += sprite.vy * (1 + energy * 3);
            sprite.rotation += sprite.rotationSpeed * (1 + energy * 3);

            const dx = sprite.x - this.centerX;
            const dy = sprite.y - this.centerY;
            const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

            // Keep particles closer to the album
            if (distanceFromCenter > this.glowRadius * 2) {
                const newAngle = Math.random() * Math.PI * 2;
                const newDistance = Math.random() * this.glowRadius;
                sprite.x = this.centerX + Math.cos(newAngle) * newDistance;
                sprite.y = this.centerY + Math.sin(newAngle) * newDistance;
            }

            // More intense glow effect
            const glowFactor = Math.max(0, 1 - (distanceFromCenter / this.glowRadius));
            const energyBoost = energy * 3;  // Increased energy influence
            
            sprite.alpha = Math.min(1, sprite.baseAlpha + (glowFactor * energyBoost));
            sprite.scale.set(sprite.baseScale * (1 + (glowFactor * energyBoost)));

            // More saturated colors
            const color = new PIXI.Color({
                h: hue / 360,
                s: Math.min(1, 0.9 * glowFactor + energy * 0.5),
                v: 1.0
            });
            sprite.tint = color.toNumber();
        }

        attemptRecovery() {
            if (this.contextLost) {
                this.contextLost = false;
                this.initializeProperties();
                this.createFogLayers();
            }
        }

        update(energy, hue) {
            if (this.useFallbackMode) return;
            if (this.contextLost) return;

            try {
                this.fogLayers.forEach((layer, layerIndex) => {
                    layer.children.forEach(sprite => {
                        this.updateParticle(sprite, energy, hue, layerIndex);
                    });
                });
            } catch (error) {
                console.error('Error in fog effect update:', error);
                this.handleFailure();
            }
        }

        resize(width, height) {
            if (this.useFallbackMode) {
                this.resizeFallbackCanvas();
                return;
            }

            try {
                if (this.app) {
                    this.app.renderer.resize(
                        Math.max(window.innerWidth, 1920),
                        Math.max(window.innerHeight, 1080)
                    );
                }
                
                const rect = this.container.getBoundingClientRect();
                this.centerX = rect.left + rect.width / 2;
                this.centerY = rect.top + rect.height / 2;
                this.spawnRadius = Math.max(window.innerWidth, window.innerHeight);
                this.glowRadius = Math.max(rect.width, rect.height) * 1.5;
            } catch (error) {
                console.error('Error resizing fog effect:', error);
                this.handleFailure();
            }
        }
    }

    // Replace mistParticles array with fogEffect
    let fogEffect = null;

    // Initialize fog effect
    function initializeFogEffect(container) {
        console.log('Initializing fog effect...');
        try {
            // If we have an existing effect that failed, destroy it completely
            if (fogEffect) {
                fogEffect.cleanup();
                fogEffect = null;
            }
            
            const effect = createFogEffect(container);
            if (effect) {
                console.log('Fog effect initialized successfully');
                return effect;
            }
            return null;
        } catch (error) {
            console.error('Failed to initialize fog effect:', error);
            return null;
        }
    }

    // Modify updateAudioEffects to separate transform properties
    function updateAudioEffects() {
        if (!isPlaying || !analyser) {
            requestAnimationFrame(updateAudioEffects);
            return;
        }

        try {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);

            // Get raw energy values
            const kickEnergy = getFrequencyBandEnergy(dataArray, 0, 4);
            const bassEnergy = getFrequencyBandEnergy(dataArray, 4, 10);
            const midEnergy = getFrequencyBandEnergy(dataArray, 10, 20);
            
            // Calculate current energy level
            const currentEnergy = Math.max(
                kickEnergy * 1.2,
                bassEnergy * 0.8,
                midEnergy * 0.6
            );

            // Update moving average
            recentEnergies.push(currentEnergy);
            recentEnergies.shift();
            
            // Calculate average energy
            const avgEnergy = recentEnergies.reduce((a, b) => a + b) / recentEnergies.length;
            
            // Update baseline and peak with decay
            baselineEnergy = Math.min(avgEnergy, baselineEnergy * 0.995 + avgEnergy * 0.005);
            peakEnergy = Math.max(currentEnergy, peakEnergy * 0.995);

            // Calculate relative energy (how much above baseline)
            const relativeEnergy = Math.max(0, (currentEnergy - baselineEnergy) / (peakEnergy - baselineEnergy));
            
            // Get the background glow element
            const glowBackground = document.querySelector('.album-glow-background');
            if (glowBackground) {
                try {
                    // Update hue rotation
                    const colors = [
                        { h: 320, s: 100, l: 50 }, // Pink
                        { h: 240, s: 100, l: 50 }, // Blue
                        { h: 60, s: 100, l: 50 }   // Yellow
                    ];
                    
                    // Cycle through colors based on time
                    const colorIndex = Math.floor((Date.now() / 2000) % colors.length);
                    const nextColorIndex = (colorIndex + 1) % colors.length;
                    const progress = (Date.now() % 2000) / 2000;
                    
                    // Interpolate between current and next color
                    const currentColor = colors[colorIndex];
                    const nextColor = colors[nextColorIndex];
                    const hue = currentColor.h + (nextColor.h - currentColor.h) * progress;
                    
                    // Dynamic glow range - increased for wider reach
                    const minGlow = 20;  // Increased from 10
                    const maxGlow = 150;  // Increased from 80
                    
                    // Calculate glow size based on relative energy
                    const normalizedEnergy = Math.pow(relativeEnergy, 1.2);
                    const glowIntensity = minGlow + (maxGlow - minGlow) * normalizedEnergy;
                    
                    // Dynamic opacity - increased for stronger glow
                    const opacity = 0.6 + (normalizedEnergy * 0.4);
                    
                    // Apply multiple layered glows for better edge definition
                    const innerGlow = `0 0 ${glowIntensity * 0.4}px hsla(${hue}, ${currentColor.s}%, ${currentColor.l}%, ${opacity * 0.8})`;
                    const middleGlow = `0 0 ${glowIntensity * 0.7}px hsla(${hue}, ${currentColor.s}%, ${currentColor.l}%, ${opacity * 0.5})`;
                    const outerGlow = `0 0 ${glowIntensity}px hsla(${hue}, ${currentColor.s}%, ${currentColor.l}%, ${opacity * 0.3})`;
                    glowBackground.style.boxShadow = `${innerGlow}, ${middleGlow}, ${outerGlow}`;

                    // Separate shake effect from other transforms
                    const shakeAmount = normalizedEnergy * 4;
                    const shakeX = Math.random() * shakeAmount - shakeAmount/2;
                    const shakeY = Math.random() * shakeAmount - shakeAmount/2;
                    
                    // Combine shake with current 3D rotation
                    const transform = `translate(${shakeX}px, ${shakeY}px) rotateX(${currentRotationX}deg) rotateY(${currentRotationY}deg)`;
                    albumCover.style.transform = transform;
                    
                    // Apply same transform to glow background (but without shake for a cool effect)
                    if (glowBackground) {
                        glowBackground.style.transform = `rotateX(${currentRotationX}deg) rotateY(${currentRotationY}deg)`;
                    }

                    // Update track title glow based on energy
                    const trackTitle = document.querySelector('.track-title');
                    if (trackTitle) {
                        const titleGlow = 5 + (normalizedEnergy * 15); // Base glow + energy-based increase
                        const titleColor = `hsla(${hue}, ${currentColor.s}%, ${currentColor.l}%, ${opacity})`;
                        trackTitle.style.textShadow = `0 0 ${titleGlow}px ${titleColor}`;
                        trackTitle.style.color = `hsla(${hue}, 70%, 80%, ${0.8 + (normalizedEnergy * 0.2)})`;
                    }

                    // Update energy effect
                    if (energyEffect) {
                        energyEffect.update(normalizedEnergy * 1.5, hue);
                    }
                } catch (error) {
                    console.error('Failed to update visual effects:', error);
                }
            }
        } catch (error) {
            console.error('Error in audio analysis:', error);
        }

        requestAnimationFrame(updateAudioEffects);
    }

    // Clock Animation with Audio Reactivity
    function updateClock() {
        const now = new Date();
        const secondHand = document.querySelector('.second-hand');
        const minuteHand = document.querySelector('.minute-hand');
        const hourHand = document.querySelector('.hour-hand');

        const seconds = now.getSeconds();
        const minutes = now.getMinutes();
        const hours = now.getHours();

        const secondsDegrees = ((seconds / 60) * 360) + 90;
        const minutesDegrees = ((minutes / 60) * 360) + ((seconds/60)*6) + 90;
        const hoursDegrees = ((hours / 12) * 360) + ((minutes/60)*30) + 90;

        if (isPlaying && analyser) {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            const totalEnergy = getFrequencyBandEnergy(dataArray, 0, 128);
            const glitchAmount = totalEnergy * 10;
            
            secondHand.style.transform = `rotate(${secondsDegrees + glitchAmount}deg)`;
            if (totalEnergy > 0.7) {
                minuteHand.style.transform = `rotate(${minutesDegrees + glitchAmount * 0.5}deg)`;
            } else {
                minuteHand.style.transform = `rotate(${minutesDegrees}deg)`;
            }
        } else {
            secondHand.style.transform = `rotate(${secondsDegrees}deg)`;
            minuteHand.style.transform = `rotate(${minutesDegrees}deg)`;
        }
        
        hourHand.style.transform = `rotate(${hoursDegrees}deg)`;
    }
    setInterval(updateClock, 50); // Increased update rate for smoother animation
    updateClock();

    // Preload audio and initialize effects
    function preloadAudio() {
        return new Promise((resolve, reject) => {
            audioPlayer.preload = 'auto';
            audioPlayer.oncanplaythrough = resolve;
            audioPlayer.onerror = reject;
        });
    }

    // Initialize all effects
    async function initializeEffects() {
        if (!audioContext && !setupAudioContext()) {
            throw new Error('Failed to initialize audio context');
        }
        
        // Create glow background first
        if (!document.querySelector('.album-glow-background')) {
            const glowBackground = document.createElement('div');
            glowBackground.className = 'album-glow-background';
            glowBackground.style.cssText = `
                position: absolute;
                width: 100%;
                height: 100%;
                border-radius: 10px;
                z-index: 1;
                box-shadow: 0 0 30px hsla(0, 100%, 50%, 0.3);
                pointer-events: none;
                transition: none;
            `;
            albumCover.parentNode.insertBefore(glowBackground, albumCover);
        }

        // Set up album cover styles
        albumCover.style.position = 'relative';
        albumCover.style.zIndex = '4'; // Ensure album is on top of everything
        albumCover.style.transition = 'none'; // Remove transitions for immediate shake effect
        
        // Initialize fog effect last
        if (!fogEffect) {
            fogEffect = initializeFogEffect(albumCover.parentNode);
        }
    }

    // Audio Controls
    playButton.addEventListener("click", async function () {
        if (audioPlayer.paused) {
            // Show loading state
            playButton.style.opacity = '0.5';
            playButton.style.cursor = 'wait';
            
            try {
                // Initialize effects first
                await initializeEffects();
                
                // Start playback
                await audioPlayer.play();
                isPlaying = true;
                playButton.classList.add("playing");
                
                // Reset tracking variables
                recentEnergies = Array(10).fill(0);
                baselineEnergy = 0;
                peakEnergy = 0;
                hueRotation = 0;
                
                // Remove any blur filter from album art
                albumCover.style.filter = 'none';
                
                // Start effects
                if (audioContext) {
                    updateAudioEffects();
                }
                
                setInterval(incrementBreakdown, 1000);
                setTimeout(revealMessage, 2000);
                
                clock.classList.remove('fade-out');
                setTimeout(() => {
                    clock.classList.add('fade-out');
                }, 15000);
                
            } catch (error) {
                console.error('Playback failed:', error);
                displayError('Failed to start playback. Please try again.');
                isPlaying = false;
                playButton.classList.remove("playing");
            } finally {
                // Reset button state
                playButton.style.opacity = '1';
                playButton.style.cursor = 'pointer';
            }
        } else {
            console.log('Stopping playback');
            audioPlayer.pause();
            playButton.classList.remove("playing");
            isPlaying = false;
            breakdown = 0;
            
            // Reset album cover to completely normal state
            albumCover.style.transition = 'box-shadow 0.5s ease-out';
            albumCover.style.boxShadow = 'none';
            albumCover.style.transform = 'none';
            albumCover.style.filter = 'none';
            
            // Reset background glow
            const glowBackground = document.querySelector('.album-glow-background');
            if (glowBackground) {
                glowBackground.style.boxShadow = '0 0 80px rgba(255, 0, 0, 0.5)';
            }
            
            // Reset body filter
            document.body.style.filter = 'none';
        }
    });

    // Modify message reveal timing in incrementBreakdown
    function incrementBreakdown() {
        if (!isPlaying) return;
        
        breakdown += 0.05;
        if (breakdown > 1) breakdown = 1;
        
        // Apply a much more subtle filter effect that won't affect the background color
        document.body.style.filter = `hue-rotate(${breakdown * 20}deg) blur(${breakdown * 1}px)`;
        
        // Reduced chance for message appearance
        if (Math.random() < breakdown * 0.1) { // Reduced from 0.2
            revealMessage();
        }
    }

    // Enhanced message reveal animation with better positioning
    function revealMessage() {
        if (!isPlaying) return;
        
        try {
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            if (!randomMessage) {
                console.warn('No messages available');
                return;
            }

            const albumRect = albumCover.getBoundingClientRect();
            const safeDistance = 150; // Safe distance from album
            let x, y;
            let attempts = 0;
            const maxAttempts = 10;

            // Calculate the "forbidden zone" around the album art
            const forbiddenZone = {
                left: albumRect.left - safeDistance,
                right: albumRect.right + safeDistance,
                top: albumRect.top - safeDistance,
                bottom: albumRect.bottom + safeDistance
            };

            do {
                // Choose a quadrant (0: top, 1: right, 2: bottom, 3: left)
                const quadrant = Math.floor(Math.random() * 4);
                
                switch(quadrant) {
                    case 0: // Top
                        x = Math.random() * window.innerWidth;
                        y = Math.random() * (albumRect.top - safeDistance);
                        break;
                    case 1: // Right
                        x = albumRect.right + safeDistance + Math.random() * (window.innerWidth - (albumRect.right + safeDistance));
                        y = Math.random() * window.innerHeight;
                        break;
                    case 2: // Bottom
                        x = Math.random() * window.innerWidth;
                        y = albumRect.bottom + safeDistance + Math.random() * (window.innerHeight - (albumRect.bottom + safeDistance));
                        break;
                    case 3: // Left
                        x = Math.random() * (albumRect.left - safeDistance);
                        y = Math.random() * window.innerHeight;
                        break;
                }
                
                attempts++;
                if (attempts >= maxAttempts) {
                    console.warn('Could not find suitable position for message');
                    return;
                }
            } while (
                x < 0 || x > window.innerWidth - 200 || y < 0 || y > window.innerHeight - 100
            );
            
            randomMessage.style.left = x + "px";
            randomMessage.style.top = y + "px";
            
            // Enhanced ghostly fade animation
            if (typeof gsap !== 'undefined') {
                // Reset any existing animations
                gsap.killTweensOf(randomMessage);
                
                // Initial setup
                gsap.set(randomMessage, {
                    opacity: 0,
                    scale: 0.8,
                    filter: 'blur(10px)'
                });
                
                // Fade in with ghostly effect
                gsap.to(randomMessage, {
                    opacity: 1,
                    scale: 1,
                    filter: 'blur(0px)',
                    duration: 2,
                    ease: "power2.inOut",
                    onComplete: () => {
                        // Hold for a moment
                        gsap.delayedCall(3, () => {
                            // Fade out with ghostly effect
                            gsap.to(randomMessage, {
                                opacity: 0,
                                scale: 1.2,
                                filter: 'blur(15px)',
                                duration: 3,
                                ease: "power2.inOut"
                            });
                        });
                    }
                });
            } else {
                // Fallback if GSAP is not available
                randomMessage.style.transition = 'all 2s ease-in-out';
                randomMessage.style.opacity = '0';
                randomMessage.style.transform = 'translate(-50%, -50%) scale(0.8)';
                randomMessage.style.filter = 'blur(10px)';
                
                requestAnimationFrame(() => {
                    randomMessage.style.opacity = '1';
                    randomMessage.style.transform = 'translate(-50%, -50%) scale(1)';
                    randomMessage.style.filter = 'blur(0px)';
                    
                    setTimeout(() => {
                        randomMessage.style.opacity = '0';
                        randomMessage.style.transform = 'translate(-50%, -50%) scale(1.2)';
                        randomMessage.style.filter = 'blur(15px)';
                    }, 5000);
                });
            }
        } catch (error) {
            console.error('Failed to reveal message:', error);
        }
    }

    // Update CSS for better play button centering
    const style = document.createElement('style');
    style.textContent = `
        .album-cover {
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        #playButton {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10;
            margin: 0;
            padding: 0;
        }
    `;
    document.head.appendChild(style);

    // Add this function to properly initialize the canvas 
    function initCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Call this right after canvas initialization
    initCanvas();

    // Add window resize handler for fog
    window.addEventListener('resize', () => {
        if (fogEffect) {
            const container = albumCover.parentNode;
            const rect = container.getBoundingClientRect();
            fogEffect.resize(rect.width * 2, rect.height * 2);
        }
    });

    // Replace fogEffect with energyEffect
    let energyEffect = null;

    // Initialize energy effect
    function initializeEnergyEffect(container) {
        console.log('Initializing energy effect...');
        try {
            if (energyEffect) {
                energyEffect.cleanup();
                energyEffect = null;
            }
            
            const effect = new EnergyEffect(container);
            console.log('Energy effect initialized successfully');
            return effect;
        } catch (error) {
            console.error('Failed to initialize energy effect:', error);
            return null;
        }
    }

    // Modify initializeEffects to use energy effect instead of fog
    async function initializeEffects() {
        if (!audioContext && !setupAudioContext()) {
            throw new Error('Failed to initialize audio context');
        }
        
        // Create glow background first
        if (!document.querySelector('.album-glow-background')) {
            const glowBackground = document.createElement('div');
            glowBackground.className = 'album-glow-background';
            glowBackground.style.cssText = `
                position: absolute;
                width: 100%;
                height: 100%;
                border-radius: 10px;
                z-index: 1;
                box-shadow: 0 0 30px hsla(0, 100%, 50%, 0.3);
                pointer-events: none;
                transition: none;
            `;
            albumCover.parentNode.insertBefore(glowBackground, albumCover);
        }

        // Set up album cover styles
        albumCover.style.position = 'relative';
        albumCover.style.zIndex = '4';
        albumCover.style.transition = 'none';
        
        // Initialize energy effect
        if (!energyEffect) {
            energyEffect = initializeEnergyEffect(albumCover.parentNode);
        }
    }

    // 3D Album Rotation Effect
    let isHovering = false;
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;
    let currentRotationX = 0;
    let currentRotationY = 0;

    // Add mouse event listeners for 3D effect
    albumCover.addEventListener("mouseenter", () => {
        isHovering = true;
    });

    albumCover.addEventListener("mouseleave", () => {
        isHovering = false;
        // Smoothly reset rotation when mouse leaves
        targetRotationX = 0;
        targetRotationY = 0;
    });

    albumCover.addEventListener("mousemove", (e) => {
        if (!isHovering) return;
        
        const rect = albumCover.getBoundingClientRect();
        // Calculate mouse position relative to the center of the album
        mouseX = (e.clientX - rect.left) / rect.width - 0.5;
        mouseY = (e.clientY - rect.top) / rect.height - 0.5;
        
        // Set target rotation (inverted for natural feel) - increased to 45 degrees
        targetRotationY = mouseX * 45; // Max 45 degrees rotation
        targetRotationX = -mouseY * 45; // Max 45 degrees rotation
    });

    // Animation loop for smooth rotation
    function updateRotation() {
        // Always update rotation regardless of playing state
        // Smoothly interpolate current rotation to target rotation
        currentRotationX += (targetRotationX - currentRotationX) * 0.1;
        currentRotationY += (targetRotationY - currentRotationY) * 0.1;
        
        // We don't need to apply the transform here anymore
        // The updateAudioEffects function will handle it when playing
        // and we'll only apply it here when not playing
        if (!isPlaying) {
            const transform = `rotateX(${currentRotationX}deg) rotateY(${currentRotationY}deg)`;
            albumCover.style.transform = transform;
            
            // Apply same transform to glow background
            const glowBackground = document.querySelector('.album-glow-background');
            if (glowBackground) {
                glowBackground.style.transform = transform;
            }
        }
        
        requestAnimationFrame(updateRotation);
    }
    updateRotation();

    // Handle clock fade-out after 30 seconds of music playback
    let musicPlaybackTime = 0;
    let clockFadeTimeout;

    function handleClockFade() {
        if (audioPlayer.paused) {
            musicPlaybackTime = 0;
            const clock = document.querySelector('.clock');
            clock.classList.remove('fade-out');
            if (clockFadeTimeout) {
                clearTimeout(clockFadeTimeout);
            }
        } else {
            musicPlaybackTime += 1;
            if (musicPlaybackTime >= 15 && !document.querySelector('.clock').classList.contains('fade-out')) {
                const clock = document.querySelector('.clock');
                clock.classList.add('fade-out');
            }
        }
    }

    setInterval(handleClockFade, 1000);
});

class EnergyEffect {
    constructor(container) {
        this.container = container;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Setup canvas - now with lower z-index to appear behind album
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '1'; // Changed to 1 to be behind album art
        this.canvas.style.mixBlendMode = 'screen';
        document.body.appendChild(this.canvas);
        
        // Initialize properties
        this.resize();
        this.energyPaths = [];
        this.lastSpawn = 0;
        this.spawnDelay = 400; // Much slower spawning for more impact
        
        // Bind methods
        this.resize = this.resize.bind(this);
        window.addEventListener('resize', this.resize);
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Get album position
        const rect = this.container.getBoundingClientRect();
        this.centerX = rect.left + rect.width / 2;
        this.centerY = rect.top + rect.height / 2;
        this.radius = Math.max(rect.width, rect.height) / 2;
    }

    createEnergyPath(energy, _) {
        const now = Date.now();
        if (now - this.lastSpawn < this.spawnDelay / energy) return; // Dynamic spawn rate based on energy
        this.lastSpawn = now;

        // Start from a random point on the album edge
        const startAngle = Math.random() * Math.PI * 2;
        const startX = this.centerX + Math.cos(startAngle) * this.radius;
        const startY = this.centerY + Math.sin(startAngle) * this.radius;

        // Create path with random direction and length
        const path = {
            points: [{x: startX, y: startY}],
            alpha: 1,
            width: 0.5 + energy, // Much thinner base width
            color: Math.random() < 0.5 ? 
                {h: 300, s: 100, l: 70} : // Brighter magenta
                {h: 180, s: 100, l: 70}, // Brighter cyan
            lifetime: Math.random() * 200 + 100, // Even shorter lifetime for more snap
            birth: now,
            branches: []
        };

        // Add points with more dramatic movement
        let currentX = startX;
        let currentY = startY;
        const segments = Math.floor(3 + energy * 4); // Fewer segments for cleaner bolts
        let currentAngle = startAngle;
        
        for (let i = 0; i < segments; i++) {
            // More dramatic angle changes
            currentAngle += (Math.random() - 0.5) * Math.PI * 2;
            const length = (30 + Math.random() * 80) * (1 + energy); // Longer segments
            
            currentX += Math.cos(currentAngle) * length;
            currentY += Math.sin(currentAngle) * length;
            
            path.points.push({x: currentX, y: currentY});
            
            // Less frequent but more dramatic branches
            if (Math.random() < 0.4 * energy) {
                this.createBranch(path, currentX, currentY, currentAngle, energy);
            }
        }

        this.energyPaths.push(path);
    }

    createBranch(path, x, y, angle, energy, depth = 0) {
        if (depth > 2) return; // Reduced max depth

        const branchAngle = angle + (Math.random() - 0.5) * Math.PI * 1.5;
        const branchLength = (20 + Math.random() * 50) * (1 + energy) * (1 - depth * 0.3);
        const endX = x + Math.cos(branchAngle) * branchLength;
        const endY = y + Math.sin(branchAngle) * branchLength;
        
        const branch = {
            start: {x, y},
            points: [{x, y}, {x: endX, y: endY}],
            width: path.width * (0.6 - depth * 0.2) // Even thinner branches
        };

        // Add midpoints for organic movement
        const midPoints = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < midPoints; i++) {
            const t = (i + 1) / (midPoints + 1);
            const perpDist = (Math.random() - 0.5) * branchLength * 0.4;
            const midX = x + (endX - x) * t + Math.cos(branchAngle + Math.PI/2) * perpDist;
            const midY = y + (endY - y) * t + Math.sin(branchAngle + Math.PI/2) * perpDist;
            branch.points.splice(-1, 0, {x: midX, y: midY});
        }

        path.branches.push(branch);

        // Reduced chance for sub-branches
        if (Math.random() < 0.3 * (1 - depth * 0.3)) {
            this.createBranch(path, endX, endY, branchAngle, energy, depth + 1);
        }
    }

    drawPath(points, width, color, alpha) {
        // Enhanced glow effect
        this.ctx.shadowBlur = 20;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Outer glow
        this.ctx.beginPath();
        this.ctx.lineWidth = width * 3;
        this.ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, ${alpha * 0.15})`;
        this.ctx.shadowColor = `hsla(${color.h}, ${color.s}%, ${color.l + 20}%, ${alpha * 0.8})`;
        this.drawLines(points);
        this.ctx.stroke();

        // Main stroke
        this.ctx.beginPath();
        this.ctx.lineWidth = width;
        this.ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, ${alpha})`;
        this.ctx.shadowColor = `hsla(${color.h}, ${color.s}%, ${color.l + 20}%, ${alpha})`;
        this.drawLines(points);
        this.ctx.stroke();

        // Inner bright core
        this.ctx.beginPath();
        this.ctx.lineWidth = width * 0.3;
        this.ctx.strokeStyle = `hsla(${color.h}, ${color.s - 20}%, ${color.l + 30}%, ${alpha})`;
        this.drawLines(points);
        this.ctx.stroke();
    }

    drawLines(points) {
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
    }

    update(energy, _) {
        const now = Date.now();
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Create new paths only with higher energy
        if (energy > 0.3) { // Higher threshold for more impact
            this.createEnergyPath(energy, 0);
        }
        
        // Update and draw existing paths
        this.energyPaths = this.energyPaths.filter(path => {
            const age = now - path.birth;
            if (age > path.lifetime) return false;
            
            path.alpha = 1 - (age / path.lifetime);
            
            // Draw main path
            this.drawPath(path.points, path.width, path.color, path.alpha);
            
            // Draw branches
            path.branches.forEach(branch => {
                this.drawPath(branch.points, branch.width, path.color, path.alpha);
            });
            
            return true;
        });
    }

    cleanup() {
        window.removeEventListener('resize', this.resize);
        this.canvas.remove();
    }
}
