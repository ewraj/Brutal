document.addEventListener('DOMContentLoaded', () => {
    // Scroll Reveal Animation
    const reveals = document.querySelectorAll('.reveal');
    
    const revealCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Once revealed, no need to keep observing
                observer.unobserve(entry.target);
            }
        });
    };

    const revealObserver = new IntersectionObserver(revealCallback, {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    });

    reveals.forEach(reveal => {
        revealObserver.observe(reveal);
    });

    // Dynamic Header Background
    const nav = document.querySelector('nav');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.style.background = 'rgba(5, 5, 5, 0.95)';
            nav.style.padding = '15px 5%';
        } else {
            nav.style.background = 'rgba(5, 5, 5, 0.8)';
            nav.style.padding = '20px 5%';
        }
    });

    // Add mouse parallax to hero glow
    const hero = document.querySelector('.hero');
    const glow = document.querySelector('.hero-glow');

    if (hero && glow) {
        hero.addEventListener('mousemove', (e) => {
            const { clientX, clientY } = e;
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            
            const moveX = (clientX - centerX) / 20;
            const moveY = (clientY - centerY) / 20;
            
            glow.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
    }
});

// --- 3D Particle Sphere ---
(function() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height, cx, cy;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        cx = width / 2;
        cy = height / 2;
    }
    window.addEventListener('resize', resize);
    resize();

    // Configuration
    const N = 1200; // Number of particles
    const R = 400;  // Sphere radius
    const bloodRedRGB = '220, 38, 38';

    // Mouse tracking for rotation
    let mouseX = 0;
    let mouseY = 0;
    let targetRotX = 0;
    let targetRotY = 0;
    let rotX = 0;
    let rotY = 0;

    window.addEventListener('mousemove', (e) => {
        // Map mouse position to rotation angles
        mouseX = (e.clientX - cx) / cx; // -1 to 1
        mouseY = (e.clientY - cy) / cy; // -1 to 1
        
        targetRotY = mouseX * Math.PI; // Look left/right
        targetRotX = -mouseY * Math.PI; // Look up/down
    });

    // Generate points using Fibonacci lattice for even distribution on a sphere
    const particles = [];
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < N; i++) {
        // phi is latitude (0 to PI)
        let phi = Math.acos(1 - 2 * (i + 0.5) / N);
        // theta is longitude (0 to 2PI)
        let theta = 2 * Math.PI * i / goldenRatio;

        // Base 3D coordinates
        let x = Math.cos(theta) * Math.sin(phi);
        let y = Math.sin(theta) * Math.sin(phi);
        let z = Math.cos(phi);

        // To make dashes, we calculate a second point slightly further along the longitude
        let theta2 = theta + 0.03; // Dash length/direction
        let x2 = Math.cos(theta2) * Math.sin(phi);
        let y2 = Math.sin(theta2) * Math.sin(phi);
        let z2 = Math.cos(phi);

        // Random wave offset so they wave organically
        let waveOffset = Math.random() * Math.PI * 2;

        particles.push({
            baseX: x, baseY: y, baseZ: z,
            baseX2: x2, baseY2: y2, baseZ2: z2,
            waveOffset: waveOffset
        });
    }

    // 3D Rotation function
    function rotate3D(x, y, z, rx, ry) {
        // Rotate around X axis
        let cosX = Math.cos(rx);
        let sinX = Math.sin(rx);
        let y1 = y * cosX - z * sinX;
        let z1 = y * sinX + z * cosX;

        // Rotate around Y axis
        let cosY = Math.cos(ry);
        let sinY = Math.sin(ry);
        let x2 = x * cosY + z1 * sinY;
        let z2 = -x * sinY + z1 * cosY;

        return { x: x2, y: y1, z: z2 };
    }

    let time = 0;

    function animate() {
        requestAnimationFrame(animate);
        time++;

        // Smooth rotation easing
        rotX += (targetRotX - rotX) * 0.05;
        rotY += (targetRotY - rotY) * 0.05;

        // Add a slow auto-rotation so it always moves slightly
        let autoRotY = rotY + time * 0.002;

        ctx.clearRect(0, 0, width, height);

        // We sort particles by Z depth so the ones in front draw on top (though with dashes it's less critical)
        let projectedParticles = [];

        for (let i = 0; i < particles.length; i++) {
            let p = particles[i];

            // The "Wave" effect: slightly pulsate the radius of each point based on time
            let currentRadius = R + Math.sin(time * 0.05 + p.waveOffset) * 15;

            // Apply radius to base coordinates
            let x1 = p.baseX * currentRadius;
            let y1 = p.baseY * currentRadius;
            let z1 = p.baseZ * currentRadius;

            let x2 = p.baseX2 * currentRadius;
            let y2 = p.baseY2 * currentRadius;
            let z2 = p.baseZ2 * currentRadius;

            // Apply 3D rotation
            let rot1 = rotate3D(x1, y1, z1, rotX, autoRotY);
            let rot2 = rotate3D(x2, y2, z2, rotX, autoRotY);

            projectedParticles.push({
                x1: rot1.x, y1: rot1.y, z: rot1.z,
                x2: rot2.x, y2: rot2.y,
            });
        }

        // Sort by Z (painters algorithm) - furthest back drawn first
        projectedParticles.sort((a, b) => b.z - a.z);

        const focalLength = 800; // Camera distance

        for (let i = 0; i < projectedParticles.length; i++) {
            let p = projectedParticles[i];

            // Only draw points that are in front of the camera
            if (p.z < -focalLength) continue;

            // Perspective projection
            let scale1 = focalLength / (focalLength + p.z);
            let screenX1 = cx + p.x1 * scale1;
            let screenY1 = cy + p.y1 * scale1;

            let scale2 = focalLength / (focalLength + p.z); // Using same depth for dash end for simplicity
            let screenX2 = cx + p.x2 * scale2;
            let screenY2 = cy + p.y2 * scale2;

            // Calculate opacity based on Z depth (points in back are dark/invisible)
            // Z goes from -R to +R. 
            // If z == R (closest to us), opacity is max. If z == -R (back of sphere), opacity is 0.
            let depthNormalized = (p.z + R) / (2 * R); // 0 (back) to 1 (front)
            let opacity = Math.max(0, depthNormalized);

            // Don't draw if fully faded
            if (opacity <= 0.05) continue;

            ctx.beginPath();
            ctx.moveTo(screenX1, screenY1);
            ctx.lineTo(screenX2, screenY2);
            
            // Apply depth scaling to line thickness to enhance 3D effect
            ctx.lineWidth = 1.5 * scale1;
            ctx.strokeStyle = `rgba(${bloodRedRGB}, ${opacity})`;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }

    animate();
})();

