document.addEventListener('DOMContentLoaded', () => {
    // --- Seleção de Elementos do DOM ---
    const dropZone = document.getElementById('drop-zone');
    const imageInput = document.getElementById('image-input');
    const muteButton = document.getElementById('mute-button');
    const audio = document.getElementById('background-music');
    const iconMuted = document.getElementById('icon-muted');
    const iconUnmuted = document.getElementById('icon-unmuted');
    
    // Contêineres principais da UI
    const interactionContainer = document.getElementById('interaction-container');
    const resultContainer = document.getElementById('result-container');
    const errorContainer = document.getElementById('error-container');

    // Elementos da UI
    const fileNameDisplay = document.getElementById('file-name-display');
    const outputElement = document.getElementById('ascii-output');
    const errorMessage = document.getElementById('error-message');
    
    // Botões
    const convertBtn = document.getElementById('convert-btn');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const resetBtn = document.getElementById('reset-btn');
    const errorOkBtn = document.getElementById('error-ok-btn');

    let asciiModule = null;
    let selectedFile = null;

    // --- Gerenciador Central de Estado da UI ---
    const updateUI = (state, data = {}) => {
        interactionContainer.style.display = 'none';
        resultContainer.style.display = 'none';
        errorContainer.style.display = 'none';
        interactionContainer.className = state;

        switch (state) {
            case 'loading':
            case 'ready':
            case 'file-selected':
            case 'processing':
                interactionContainer.style.display = 'flex';
                if (state === 'file-selected') {
                    fileNameDisplay.textContent = data.fileName;
                }
                break;
            case 'success':
                resultContainer.style.display = 'flex';
                streamAscii(data.asciiArt, outputElement);
                break;
            case 'error':
                errorContainer.style.display = 'flex';
                errorMessage.textContent = data.message;
                break;
        }
    };

    // --- Carregamento do módulo WebAssembly ---
    updateUI('loading');
    createAsciiModule().then(Module => {
        console.log("Motor de transmutação (WASM) carregado.");
        asciiModule = Module;
        updateUI('ready');
    }).catch(err => {
        console.error("Falha ao carregar o módulo WebAssembly:", err);
        updateUI('error', { message: 'Não foi possível carregar o motor de conversão.' });
    });

    // --- Lógica de seleção e arraste do file  ---
    const handleFileSelection = (file) => {
        if (!file || !file.type.startsWith('image/')) {
            updateUI('error', { message: 'Por favor, selecione um arquivo de imagem válido.' });
            return;
        }
        selectedFile = file;
        updateUI('file-selected', { fileName: selectedFile.name });
    };

    dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); });
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
    dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });
    dropZone.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', () => handleFileSelection(imageInput.files[0]));

    // --- Lógica dos botões ---
    const resetFlow = () => {
        selectedFile = null;
        imageInput.value = '';
        updateUI('ready');
    };

    removeFileBtn.addEventListener('click', resetFlow);
    resetBtn.addEventListener('click', resetFlow);
    errorOkBtn.addEventListener('click', resetFlow);
    convertBtn.addEventListener('click', () => {
        if (selectedFile) processFile(selectedFile);
    });

    // --- Processamento do file com WASM ---
    const processFile = (file) => {
        if (!asciiModule) {
            updateUI('error', { message: 'O motor de processamento ainda não está pronto.' });
            return;
        }
        
        updateUI('processing');
        const reader = new FileReader();
        reader.onload = function(e) {
            const uint8Array = new Uint8Array(e.target.result);
            
            setTimeout(() => {
                let jsVector = null;
                try {
                    jsVector = new asciiModule.VectorUChar();
                    uint8Array.forEach(byte => jsVector.push_back(byte));
                    const asciiArt = asciiModule.convertToASCII(jsVector);
                    
                    if (asciiArt.startsWith("Erro")) {
                        updateUI('error', { message: `Ocorreu um erro na conversão: ${asciiArt}` });
                    } else {
                        updateUI('success', { asciiArt });
                    }
                } catch (err) {
                    console.error("Erro na execução do WebAssembly:", err);
                    updateUI('error', { message: 'Ocorreu um erro crítico durante a transmutação.' });
                } finally {
                    jsVector?.delete();
                }
            }, 100);
        };
        reader.onerror = () => {
            updateUI('error', { message: 'Não foi possível ler o arquivo selecionado.' });
        };
        reader.readAsArrayBuffer(file);
    };
    
    // --- Função para exibir o texto ASCII gradualmente (de forma dinâmica) ---
    const streamAscii = (text, element) => {
        element.textContent = '';
        const lines = text.split('\n');
        const totalDuration = 1000;
        const intervalTime = Math.max(1, totalDuration / lines.length);
        let currentLine = 0;

        const intervalId = setInterval(() => {
            if (currentLine < lines.length) {
                element.textContent += lines[currentLine] + '\n';
                currentLine++;
            } else {
                clearInterval(intervalId);
            }
        }, intervalTime);
    };

    // --- Controle de Áudio ---
    let hasInteracted = false;
    const startAudio = () => {
        if(hasInteracted) return;
        hasInteracted = true;
        audio.play().catch(e => console.error("Erro ao tocar áudio:", e));
        audio.muted = false;
        updateMuteIcon();
    };
    document.body.addEventListener('click', startAudio, { once: true });
    document.body.addEventListener('keydown', startAudio, { once: true });

    muteButton.addEventListener('click', () => {
        audio.muted = !audio.muted;
        updateMuteIcon();
    });

    const updateMuteIcon = () => {
        iconUnmuted.style.display = audio.muted ? 'none' : 'block';
        iconMuted.style.display = audio.muted ? 'block' : 'none';
    };
    updateMuteIcon();

    // --- Efeitos visuais interativos ---

    // Efeito de inversão do título (this inverts when mouse is hovered over)
    const titleElement = document.querySelector('.main-title');
    const titleText = titleElement.textContent;
    titleElement.innerHTML = '';
    titleText.split('').forEach((char, index) => {
        const span = document.createElement('span');
        if (char === ' ') {
            span.innerHTML = '&nbsp;';
        } else {
            span.textContent = char;
        }
        span.style.transitionDelay = `${index * 40}ms`;
        titleElement.appendChild(span);
    });

    // Efeito de "spotlight" no background (o circulo que acompanha a tela quando o user passa o mouse no background)
    window.addEventListener('mousemove', e => {
        document.body.style.setProperty('--mouse-x', `${e.clientX}px`);
        document.body.style.setProperty('--mouse-y', `${e.clientY}px`);
    });

    // --- Animação de partículas e estrela cadente ---
    const canvas = document.getElementById('fireflies-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let shootingStar;
    let mouse = { x: undefined, y: undefined };

    window.addEventListener('mousemove', (event) => {
        mouse.x = event.x;
        mouse.y = event.y;
    });
    
    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 1.5 + 0.5;
            this.speedX = Math.random() * 0.4 - 0.2;
            this.speedY = Math.random() * 0.4 - 0.2;
            this.opacity = Math.random() * 0.5 + 0.5;
        }
        update() {
            if (mouse.x !== undefined) {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 150) {
                    const force = (150 - distance) / 150;
                    this.x += (dx / distance) * force * 0.5;
                    this.y += (dy / distance) * force * 0.5;
                }
            }
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x < 0 || this.x > canvas.width) this.x = Math.random() * canvas.width;
            if (this.y < 0 || this.y > canvas.height) this.y = Math.random() * canvas.height;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(100, 230, 190, ${this.opacity})`;
            ctx.fill();
        }
    }

    class ShootingStar {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = 0;
            this.len = Math.random() * 80 + 10;
            this.speed = Math.random() * 5 + 3;
            this.angle = Math.PI / 4;
            this.life = 3;
            this.waitTime = Math.random() * 7 + 3;
        }
        update(deltaTime) {
            if (this.waitTime > 0) {
                this.waitTime -= deltaTime;
                return;
            }
            if (this.life > 0) {
                this.life -= deltaTime;
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed;
            } else {
                this.reset();
            }
        }
        draw() {
            if (this.waitTime > 0) return;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - this.len * Math.cos(this.angle), this.y - this.len * Math.sin(this.angle));
            const gradient = ctx.createLinearGradient(this.x, this.y, this.x - this.len * Math.cos(this.angle), this.y - this.len * Math.sin(this.angle));
            const opacity = (this.life / 3) * 0.7;
            gradient.addColorStop(0, `rgba(100, 230, 190, ${opacity})`);
            gradient.addColorStop(1, 'rgba(100, 230, 190, 0)');
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    const initCanvasElements = () => {
        particles = [];
        const numParticles = (canvas.width * canvas.height) / 25000;
        for (let i = 0; i < numParticles; i++) {
            particles.push(new Particle());
        }
        shootingStar = new ShootingStar();
    };

    let lastTime = 0;
    const animate = (currentTime) => {
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        shootingStar.update(deltaTime);
        shootingStar.draw();
        requestAnimationFrame(animate);
    };

    initCanvasElements();
    animate(0);
    window.addEventListener('resize', initCanvasElements);
});

