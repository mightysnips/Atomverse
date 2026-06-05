// ============================================================================
// ATOMVERSE - MAIN APPLICATION SCRIPT
// Interactive 3D Periodic Table with Three.js
// ============================================================================

class AtomVerse {
    constructor() {
        this.elements = window.ELEMENTS || COMPLETE_PERIODIC_TABLE;
        this.elementMap = {};
        this.selectedElement = null;
        this.currentFilter = 'all';
        this.researchMode = false;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.atomVisualization = null;
        this.animationId = null;
        this.tooltip = null;
        this.structureScene = null;
        this.structureCamera = null;
        this.structureRenderer = null;
        this.structureGroup = null;
        this.subatomicGroup = null;
        this.subatomicMode = false;
        this.subatomicMeshes = [];
        this.subatomicGroups = [];
        this.subatomicExploded = {};
        this.subatomicLabelSprite = null;
        this.subatomicHoverTarget = null;
        this.subatomicHoverListener = null;
        this.subatomicClickListener = null;
        this.subatomicLeaveListener = null;
        this.subatomicInfoPanel = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.structureAnimationId = null;
        this.structureResizeListener = null;
        this.structureOverlay = null;
        this.structureCanvas = null;
        this.activeStructureElement = null;
        
        this.init();
    }

    init() {
        this.buildElementMap();
        this.setupEventListeners();
        this.createTooltip();
        this.renderPeriodicGrid();
        this.hideLoadingIndicator();
    }

    setupEventListeners() {
        // Search input
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleFilter(e.target.dataset.category);
            });
        });

        // Research mode toggle
        document.getElementById('researchModeBtn').addEventListener('click', () => {
            this.toggleResearchMode();
        });

        // Atomic structure fullscreen button
        const structureBtn = document.getElementById('structureViewBtn');
        if (structureBtn) {
            structureBtn.addEventListener('click', () => this.openStructureOverlay());
        }

        // Close viewer panel
        document.getElementById('closePanel').addEventListener('click', () => {
            this.closeViewer();
        });

        // Close structure overlay
        const subatomicBtn = document.getElementById('subatomicViewBtn');
        if (subatomicBtn) {
            subatomicBtn.addEventListener('click', () => this.toggleSubatomicView());
        }

        const closeStructure = document.getElementById('closeStructure');
        if (closeStructure) {
            closeStructure.addEventListener('click', () => this.closeStructureOverlay());
        }

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeViewer();
                this.closeStructureOverlay();
            }
        });
    }

    renderPeriodicGrid() {
        const grid = document.getElementById('periodicGrid');
        grid.innerHTML = '';

        this.elements.forEach(element => {
            const categoryKey = this.getCategoryKey(element.category || element.categoryKey || 'unknown');
            if (this.currentFilter !== 'all' && categoryKey !== this.currentFilter) {
                return;
            }

            const card = this.createElementCard(element, categoryKey);
            if (element.pos && element.pos.row && element.pos.col) {
                card.style.gridRowStart = element.pos.row;
                card.style.gridColumnStart = element.pos.col;
            }
            grid.appendChild(card);
        });
    }

    createElementCard(element, categoryKey) {
        const card = document.createElement('div');
        card.className = `element-card category-${categoryKey}`;
        card.dataset.category = categoryKey;
        card.dataset.atomicNumber = element.atomicNumber || element.number;

        card.innerHTML = `
            <div class="element-atomic-number">${element.atomicNumber || element.number}</div>
            <div class="element-symbol">${element.symbol}</div>
            <div class="element-name">${element.name}</div>
            <div class="element-mass">${element.atomicMass}</div>
        `;

        card.addEventListener('click', () => {
            this.selectElement(element);
        });

        card.addEventListener('mouseenter', (e) => this.showTooltip(element, e));
        card.addEventListener('mousemove', (e) => this.moveTooltip(e));
        card.addEventListener('mouseleave', () => this.hideTooltip());

        return card;
    }

    handleSearch(query) {
        const searchTerm = query.toLowerCase();
        const cards = document.querySelectorAll('.element-card');

        cards.forEach(card => {
            const atomicNum = parseInt(card.dataset.atomicNumber, 10);
            const element = this.elementMap[atomicNum];
            if (!element) return;

            const matches =
                element.name.toLowerCase().includes(searchTerm) ||
                element.symbol.toLowerCase().includes(searchTerm) ||
                atomicNum.toString().includes(searchTerm);

            if (matches && (this.currentFilter === 'all' || this.getCategoryKey(element.category) === this.currentFilter)) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
    }

    handleFilter(category) {
        this.currentFilter = category;

        // Update filter button active state
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.category === category) {
                btn.classList.add('active');
            }
        });

        // Re-render grid
        this.renderPeriodicGrid();
        this.reapplySearch();
    }

    reapplySearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput.value) {
            this.handleSearch(searchInput.value);
        }
    }

    toggleResearchMode() {
        this.researchMode = !this.researchMode;
        const btn = document.getElementById('researchModeBtn');
        const section = document.getElementById('researchSection');
        const status = document.getElementById('researchStatus');

        if (this.researchMode) {
            btn.classList.add('active');
            section.style.display = 'block';
            status.textContent = this.selectedElement
                ? `Research active for ${this.selectedElement.name}. Scroll for the latest discoveries.`
                : 'Research mode is active. Click an element to see its research insights.';
            this.renderResearchPanel();
        } else {
            btn.classList.remove('active');
            section.style.display = 'none';
        }
    }

    buildElementMap() {
        this.elementMap = {};
        this.elements.forEach(element => {
            const number = element.atomicNumber || element.number;
            if (number) {
                this.elementMap[number] = element;
            }
        });
    }

    renderResearchPanel() {
        const cardsContainer = document.getElementById('researchCards');
        const status = document.getElementById('researchStatus');
        cardsContainer.innerHTML = '';

        if (!this.researchMode) {
            status.textContent = 'Research mode is off. Click the button above to begin.';
            return;
        }

        const discoveries = [
            {
                title: 'Oganesson Synthesis Verified',
                summary: 'A new analysis of element 118 confirmed relativistic orbital behavior and advanced superheavy chemistry research.',
                element: 'Og',
                year: '2024'
            },
            {
                title: 'Tennessine Isotope Stability',
                summary: 'Researchers mapped decay chains and half-life trends for Ts isotopes, improving next-generation element synthesis.',
                element: 'Ts',
                year: '2025'
            },
            {
                title: 'Promethium Microbattery Breakthrough',
                summary: 'A microbattery prototype using Promethium showed record energy density in extreme low-temperature environments.',
                element: 'Pm',
                year: '2026'
            },
            {
                title: 'Gold Electron Plasmon Imaging',
                summary: 'Atomic-scale imaging revealed femtosecond electron response in gold nanoparticles, enabling advanced photonics.',
                element: 'Au',
                year: '2025'
            },
            {
                title: 'Neon-Based Quantum Cooling',
                summary: 'Neon gas was used to stabilize quantum devices at record low temperatures, opening paths for next-gen computing.',
                element: 'Ne',
                year: '2025'
            },
            {
                title: 'Lanthanide Photon Conversion',
                summary: 'A terbium-doped material created highly efficient photon upconversion for display and solar technologies.',
                element: 'Tb',
                year: '2026'
            },
            {
                title: 'Platinum Catalyst Redesign',
                summary: 'New Pt surface structures advanced green hydrogen production with lower energy barriers and higher selectivity.',
                element: 'Pt',
                year: '2025'
            },
            {
                title: 'Carbon-60 Medical Nanocarriers',
                summary: 'A C60 derivative was engineered to carry chemotherapy drugs safely to tumor cells using electron-rich cage chemistry.',
                element: 'C',
                year: '2026'
            }
        ];

        discoveries.forEach(discovery => {
            const card = document.createElement('div');
            card.className = 'discovery-card';
            card.innerHTML = `
                <strong>${discovery.title}</strong>
                <p>${discovery.summary}</p>
                <div class="card-meta">Element: ${discovery.element} · Year: ${discovery.year}</div>
            `;
            cardsContainer.appendChild(card);
        });

        if (this.selectedElement) {
            status.textContent = `Research active for ${this.selectedElement.name}. Latest discoveries below.`;
        }
    }

    openStructureOverlay() {
        const overlay = document.getElementById('structureOverlay');
        if (!overlay) return;

        this.structureOverlay = overlay;
        overlay.classList.add('active');
        this.activeStructureElement = this.selectedElement || this.elements[0] || this.elements[1];
        this.structureCanvas = document.getElementById('structureCanvas');
        const infoPanel = document.getElementById('subatomicInfoPanel');
        if (infoPanel) {
            infoPanel.style.display = 'none';
            this.subatomicInfoPanel = infoPanel;
        }
        this.subatomicMode = false;
        const subatomicBtn = document.getElementById('subatomicViewBtn');
        if (subatomicBtn) {
            subatomicBtn.textContent = 'Subatomic View';
        }

        this.updateStructureOverlayInfo(this.activeStructureElement);
        this.initializeStructureScene(this.activeStructureElement);

        if (this.structureCanvas) {
            if (this.subatomicHoverListener) {
                this.structureCanvas.removeEventListener('mousemove', this.subatomicHoverListener);
            }
            if (this.subatomicLeaveListener) {
                this.structureCanvas.removeEventListener('mouseleave', this.subatomicLeaveListener);
            }
            if (this.subatomicClickListener) {
                this.structureCanvas.removeEventListener('pointerdown', this.subatomicClickListener);
            }
            this.subatomicHoverListener = (e) => this.handleStructurePointerMove(e);
            this.subatomicClickListener = (e) => this.handleStructurePointerClick(e);
            this.subatomicLeaveListener = () => this.clearSubatomicHover();
            this.structureCanvas.addEventListener('mousemove', this.subatomicHoverListener);
            this.structureCanvas.addEventListener('pointerdown', this.subatomicClickListener);
            this.structureCanvas.addEventListener('mouseleave', this.subatomicLeaveListener);
        }

        const panel = document.querySelector('.structure-shell-panel');
        if (panel && typeof gsap !== 'undefined') {
            gsap.fromTo(panel, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' });
        }
    }

    closeStructureOverlay() {
        const overlay = document.getElementById('structureOverlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
        if (this.structureAnimationId) {
            cancelAnimationFrame(this.structureAnimationId);
            this.structureAnimationId = null;
        }
        if (this.subatomicInfoPanel) {
            this.subatomicInfoPanel.style.display = 'none';
        }
        this.subatomicMode = false;
        this.subatomicGroup = null;
        this.subatomicMeshes = [];
        this.subatomicHoverTarget = null;
        if (this.subatomicInfoPanel) {
            this.subatomicInfoPanel.style.display = 'none';
        }
        this.subatomicMode = false;
        this.subatomicGroup = null;
        this.subatomicMeshes = [];
        this.subatomicHoverTarget = null;
        if (this.structureResizeListener) {
            window.removeEventListener('resize', this.structureResizeListener);
            this.structureResizeListener = null;
        }
        if (this.structureCanvas && this.subatomicHoverListener) {
            this.structureCanvas.removeEventListener('mousemove', this.subatomicHoverListener);
            this.subatomicHoverListener = null;
        }
        if (this.structureCanvas && this.subatomicClickListener) {
            this.structureCanvas.removeEventListener('pointerdown', this.subatomicClickListener);
            this.subatomicClickListener = null;
        }
        if (this.structureCanvas && this.subatomicLeaveListener) {
            this.structureCanvas.removeEventListener('mouseleave', this.subatomicLeaveListener);
            this.subatomicLeaveListener = null;
        }
        if (this.subatomicLabelSprite && this.structureScene) {
            this.structureScene.remove(this.subatomicLabelSprite);
            this.subatomicLabelSprite = null;
        }
        if (this.structureRenderer) {
            this.structureRenderer.dispose();
            this.structureRenderer = null;
            this.structureScene = null;
            this.structureCamera = null;
            this.structureGroup = null;
        }
    }

    updateStructureOverlayInfo(element) {
        if (!element) return;
        document.getElementById('structureTitle').textContent = `${element.name} Atomic Structure`;
        document.getElementById('structureSubtitle').textContent = `Live 3D model showing ${element.name}'s electron shells and orbital layout.`;
        document.getElementById('structureElementName').textContent = `${element.symbol} — ${element.name}`;
        document.getElementById('structureShells').textContent = this.getShellLabel(element);
        document.getElementById('structureOrbitals').textContent = this.getOrbitalLabel(element);
    }

    getShellLabel(element) {
        const shells = this.getElementShells(element);
        return shells.join(' · ');
    }

    getOrbitalLabel(element) {
        return element.orbitalShells || (typeof generateOrbitalShells === 'function'
            ? generateOrbitalShells(element.atomicNumber || element.number)
            : 'K');
    }

    getElementShells(element) {
        const atomicNumber = element.atomicNumber || element.number;
        if (Array.isArray(element.shells) && element.shells.length) {
            return element.shells;
        }
        if (Array.isArray(element.electronShells) && element.electronShells.length) {
            return element.electronShells;
        }
        if (typeof generateElectronShells === 'function') {
            return generateElectronShells(atomicNumber);
        }
        return [atomicNumber];
    }

    initializeStructureScene(element) {
        if (!this.structureCanvas) return;

        const width = this.structureCanvas.clientWidth;
        const height = this.structureCanvas.clientHeight;

        this.structureScene = new THREE.Scene();
        this.structureScene.background = new THREE.Color(0x02030a);

        this.structureCamera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
        this.structureCamera.position.set(0, 0, 88);
        this.structureCamera.lookAt(0, 0, 0);

        this.structureRenderer = new THREE.WebGLRenderer({ canvas: this.structureCanvas, antialias: true, alpha: true });
        this.structureRenderer.setSize(width, height);
        this.structureRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.structureRenderer.setClearColor(0x000000, 1);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
        this.structureScene.add(ambientLight);

        const pointLight = new THREE.PointLight(0x7c4dff, 1.1);
        pointLight.position.set(60, 60, 80);
        this.structureScene.add(pointLight);

        const pointLight2 = new THREE.PointLight(0x00d9ff, 0.9);
        pointLight2.position.set(-50, -30, 60);
        this.structureScene.add(pointLight2);

        this.structureGroup = new THREE.Group();
        this.structureScene.add(this.structureGroup);
        this.createStructureVisualization(element);

        const handleResize = () => {
            if (!this.structureCanvas || !this.structureCamera || !this.structureRenderer) return;
            const newWidth = this.structureCanvas.clientWidth;
            const newHeight = this.structureCanvas.clientHeight;
            this.structureCamera.aspect = newWidth / newHeight;
            this.structureCamera.updateProjectionMatrix();
            this.structureRenderer.setSize(newWidth, newHeight);
        };

        if (this.structureResizeListener) {
            window.removeEventListener('resize', this.structureResizeListener);
        }
        this.structureResizeListener = handleResize;
        window.addEventListener('resize', this.structureResizeListener);
        handleResize();
        this.animateStructure();
    }

    createStructureVisualization(element) {
        if (!this.structureGroup) return;
        this.structureGroup.clear();

        const atomicNumber = element.atomicNumber || element.number || 1;
        const sizeScale = Math.max(0.42, 1 - atomicNumber * 0.0034);
        const nucleusColor = atomicNumber > 70 ? 0xff8aff : 0xff4de8;
        const nucleusRadius = (4 + Math.min(4, Math.floor(atomicNumber / 24))) * sizeScale;

        const nucleus = new THREE.Mesh(
            new THREE.SphereGeometry(nucleusRadius, 48, 48),
            new THREE.MeshStandardMaterial({
                color: nucleusColor,
                emissive: nucleusColor,
                emissiveIntensity: 0.48,
                roughness: 0.16,
                metalness: 0.8
            })
        );
        nucleus.castShadow = true;
        this.structureGroup.add(nucleus);

        const halo = new THREE.Mesh(
            new THREE.SphereGeometry(nucleusRadius * 1.7, 32, 32),
            new THREE.MeshBasicMaterial({
                color: nucleusColor,
                transparent: true,
                opacity: 0.12,
                side: THREE.BackSide
            })
        );
        this.structureGroup.add(halo);

        const labelSprite = this.createTextSprite(element.symbol, {
            color: '#77e8ff',
            backgroundColor: 'rgba(0,0,0,0)',
            fontSize: 30,
            padding: 10
        });
        labelSprite.position.set(0, nucleusRadius + 3.5, 0);
        this.structureGroup.add(labelSprite);

        const starCount = 140;
        const stars = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            const distance = 120 + Math.random() * 150;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            stars[i * 3] = Math.sin(phi) * Math.cos(theta) * distance;
            stars[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * distance;
            stars[i * 3 + 2] = Math.cos(phi) * distance;
        }
        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0x88ccff, size: 1.2, transparent: true, opacity: 0.65 });
        const starField = new THREE.Points(starGeometry, starMaterial);
        this.structureScene.add(starField);

        const shells = this.getElementShells(element).map(count => parseInt(count, 10) || 0).filter(count => count > 0);
        const baseRadii = [14, 20, 26, 32, 38, 44, 50];
        const orbitColors = [0x82cfff, 0xb985ff, 0x6de3c8, 0xffa566, 0xff6fa3, 0x7ee3a4, 0xc8f5ff];

        shells.forEach((count, shellIndex) => {
            if (shellIndex >= baseRadii.length || count <= 0) return;
            const radius = baseRadii[shellIndex] * sizeScale * 0.9;
            const orbitColor = orbitColors[shellIndex % orbitColors.length];

            const orbitPoints = [];
            const orbitSegments = 120;
            for (let i = 0; i <= orbitSegments; i++) {
                const angle = (i / orbitSegments) * Math.PI * 2;
                orbitPoints.push(
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius,
                    0
                );
            }
            const orbitGeometry = new THREE.BufferGeometry();
            orbitGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(orbitPoints), 3));
            const orbitMaterial = new THREE.LineBasicMaterial({
                color: 0x4f6379,
                transparent: true,
                opacity: 0.12
            });
            const orbit = new THREE.LineLoop(orbitGeometry, orbitMaterial);
            this.structureGroup.add(orbit);

            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const electron = new THREE.Mesh(
                    new THREE.SphereGeometry(Math.max(0.8, 1.4 * sizeScale), 12, 12),
                    new THREE.MeshStandardMaterial({
                        color: orbitColor,
                        emissive: orbitColor,
                        emissiveIntensity: 0.7,
                        roughness: 0.2,
                        metalness: 0.5
                    })
                );
                electron.userData = {
                    radius,
                    phase: (i / count) * Math.PI * 2,
                    speed: 0.9 + shellIndex * 0.12
                };
                electron.position.set(
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius,
                    0
                );
                this.structureGroup.add(electron);
            }
        });

        this.structureGroup.rotation.set(0.04, 0, 0);
    }

    animateStructure() {
        this.structureAnimationId = requestAnimationFrame(() => this.animateStructure());
        if (!this.structureGroup) return;

        const time = performance.now() * 0.001;
        this.structureGroup.children.forEach(child => {
            if (child.userData && child.userData.radius) {
                const { radius, speed, phase } = child.userData;
                const angle = phase + time * speed;
                child.position.x = Math.cos(angle) * radius;
                child.position.y = Math.sin(angle) * radius;
                child.position.z = 0;
            }
        });

        if (!this.subatomicMode) {
            this.structureGroup.rotation.z += 0.0006;
        } else if (this.subatomicGroups && this.subatomicGroups.length) {
            this.subatomicGroups.forEach((group, index) => {
                group.rotation.x += 0.0009 + index * 0.0003;
                group.rotation.y += 0.0011 + index * 0.0002;
            });
        }

        if (this.structureRenderer && this.structureCamera) {
            this.structureRenderer.render(this.structureScene, this.structureCamera);
        }
    }

    toggleSubatomicView() {
        const btn = document.getElementById('subatomicViewBtn');
        const infoPanel = document.getElementById('subatomicInfoPanel');
        this.subatomicMode = !this.subatomicMode;

        if (this.subatomicMode) {
            if (btn) btn.textContent = 'Back to Atom';
            if (infoPanel) infoPanel.style.display = 'block';
            document.getElementById('structureTitle').textContent = 'Subatomic Structure';
            document.getElementById('structureSubtitle').textContent = 'Explore proton, neutron and electron internal architecture in 3D.';
            this.createSubatomicVisualization(this.activeStructureElement);
        } else {
            if (btn) btn.textContent = 'Subatomic View';
            if (infoPanel) infoPanel.style.display = 'none';
            if (this.subatomicLabelSprite && this.structureScene) {
                this.structureScene.remove(this.subatomicLabelSprite);
                this.subatomicLabelSprite = null;
            }
            this.updateStructureOverlayInfo(this.activeStructureElement);
            this.createStructureVisualization(this.activeStructureElement);
        }
    }

    createSubatomicVisualization(element) {
        if (!this.structureGroup) return;
        this.structureGroup.clear();
        this.subatomicMeshes = [];
        this.subatomicGroups = [];
        this.subatomicExploded = {};
        this.subatomicHoverTarget = null;

        const particleDefinitions = [
            {
                type: 'electron',
                color: 0x5ce1e6,
                position: [-18, 0, 0],
                label: 'Electron',
                detail: 'A fundamental lepton that exists as a sine-cosine waveform packet. Click to reveal the wave structure inside the electron.'
            },
            {
                type: 'proton',
                color: 0xff6eb0,
                position: [14, 10, 0],
                label: 'Proton',
                detail: 'A baryon made of two up quarks and one down quark, held together by gluons. Click to reveal the quarks and gluons inside.'
            },
            {
                type: 'neutron',
                color: 0x7e88ff,
                position: [14, -10, 0],
                label: 'Neutron',
                detail: 'A baryon made of one up quark and two down quarks, bound by gluons. Click to reveal the quarks, charges, and gluon connections.'
            }
        ];

        this.subatomicGroup = new THREE.Group();
        this.structureGroup.add(this.subatomicGroup);

        particleDefinitions.forEach(def => {
            const particle = this.createParticleStructure(def);
            this.subatomicGroups.push(particle);
            this.subatomicGroup.add(particle);
        });

        this.subatomicHoverTarget = null;
        this.structuralRotation = 0;
    }

    createParticleStructure(def) {
        const group = new THREE.Group();
        group.position.set(def.position[0], def.position[1], def.position[2]);

        const outerRadius = def.type === 'electron' ? 6 : 8;
        const outer = new THREE.Mesh(
            new THREE.SphereGeometry(outerRadius, 24, 24),
            new THREE.MeshPhysicalMaterial({
                color: def.color,
                transparent: true,
                opacity: 0.18,
                roughness: 0.28,
                metalness: 0.08,
                clearcoat: 0.75,
                clearcoatRoughness: 0.25
            })
        );
        outer.userData = {
            title: def.label,
            info: def.detail,
            parentParticle: def.type,
            clickable: true
        };
        group.add(outer);
        this.subatomicMeshes.push(outer);

        const internals = new THREE.Group();
        internals.visible = false;
        group.add(internals);

        if (def.type === 'electron') {
            this.buildElectronInternals(internals, def);
            const ring = this.createOrbitRing(outerRadius + 1.4, def.color, 0.16);
            group.add(ring);
        } else {
            this.buildBaryonInternals(internals, def);
        }

        group.userData = {
            particleType: def.type,
            title: def.label,
            info: def.detail,
            outerMesh: outer,
            internals: internals
        };

        return group;
    }

    buildElectronInternals(container, def) {
        const glowColor = new THREE.Color(0x94f7ff);
        const waveformCount = 22;
        const waveAmplitude = 2.4;
        const waveSpacing = 0.5;
        for (let i = 0; i < waveformCount; i++) {
            const t = i * 0.25;
            const x = (i - (waveformCount - 1) / 2) * waveSpacing;
            const y = Math.sin(t * 1.4) * waveAmplitude;
            const z = Math.cos(t * 1.4) * waveAmplitude * 0.35;
            const segment = new THREE.Mesh(
                new THREE.SphereGeometry(0.55, 12, 12),
                new THREE.MeshStandardMaterial({
                    color: 0x8cffff,
                    emissive: glowColor,
                    emissiveIntensity: 0.75,
                    roughness: 0.12,
                    metalness: 0.3,
                    transparent: true,
                    opacity: 0.0
                })
            );
            segment.position.set(x, y, z);
            segment.userData = {
                title: `Electron Wave Phase ${i + 1}`,
                info: 'A sine-cosine waveform segment representing the electron wave packet inside the electron shell.'
            };
            segment.visible = false;
            container.add(segment);
            this.subatomicMeshes.push(segment);
        }

        const core = new THREE.Mesh(
            new THREE.SphereGeometry(2.2, 28, 28),
            new THREE.MeshStandardMaterial({
                color: 0x66f2ff,
                emissive: 0x66f2ff,
                emissiveIntensity: 1.1,
                roughness: 0.08,
                metalness: 0.7,
                transparent: true,
                opacity: 0.0
            })
        );
        core.userData = {
            title: 'Electron Wave Core',
            info: 'The electron core is a compact waveform packet, showing the sine-cosine wave structure inside the electron.'
        };
        core.visible = false;
        container.add(core);
        this.subatomicMeshes.push(core);
    }

    buildBaryonInternals(container, def) {
        const quarkOffsets = [
            [0, 4.8, 0],
            [-4.2, -2.2, 0],
            [4.2, -2.2, 0]
        ];
        const quarkColors = def.type === 'proton'
            ? [0xff9ec9, 0xff9ec9, 0xa54dff]
            : [0xff9ec9, 0xa54dff, 0xa54dff];
        const quarkLabels = def.type === 'proton'
            ? ['Up Quark', 'Up Quark', 'Down Quark']
            : ['Up Quark', 'Down Quark', 'Down Quark'];

        quarkOffsets.forEach((pos, index) => {
            const charge = quarkLabels[index] === 'Up Quark' ? '+2/3' : '-1/3';
            const quark = new THREE.Mesh(
                new THREE.SphereGeometry(2.8, 20, 20),
                new THREE.MeshStandardMaterial({
                    color: quarkColors[index],
                    emissive: quarkColors[index],
                    emissiveIntensity: 0.85,
                    roughness: 0.18,
                    metalness: 0.4,
                    transparent: true,
                    opacity: 0.0
                })
            );
            quark.position.set(pos[0], pos[1], pos[2]);
            quark.userData = {
                title: `${quarkLabels[index]} (${def.label})`, 
                info: `A ${quarkLabels[index].toLowerCase()} carrying charge ${charge} inside the ${def.label.toLowerCase()}.` 
                    + ' It is held in place by gluon exchange.'
            };
            quark.visible = false;
            container.add(quark);
            this.subatomicMeshes.push(quark);
        });

        const gluonPositions = [
            [(quarkOffsets[0][0] + quarkOffsets[1][0]) / 2, (quarkOffsets[0][1] + quarkOffsets[1][1]) / 2, 0],
            [(quarkOffsets[1][0] + quarkOffsets[2][0]) / 2, (quarkOffsets[1][1] + quarkOffsets[2][1]) / 2, 0],
            [(quarkOffsets[2][0] + quarkOffsets[0][0]) / 2, (quarkOffsets[2][1] + quarkOffsets[0][1]) / 2, 0]
        ];
        gluonPositions.forEach((pos, index) => {
            const gluon = new THREE.Mesh(
                new THREE.SphereGeometry(1.2, 14, 14),
                new THREE.MeshStandardMaterial({
                    color: 0xffd46b,
                    emissive: 0xffc65d,
                    emissiveIntensity: 0.9,
                    roughness: 0.1,
                    metalness: 0.2,
                    transparent: true,
                    opacity: 0.0
                })
            );
            gluon.position.set(pos[0], pos[1], pos[2]);
            gluon.userData = {
                title: `Gluon (${def.label})`, 
                info: 'A gluon carries the strong force that binds the quarks inside the baryon.'
            };
            gluon.visible = false;
            container.add(gluon);
            this.subatomicMeshes.push(gluon);
        });
    }

    createOrbitRing(radius, color, opacity = 0.16) {
        const ring = new THREE.LineLoop(
            new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(
                new Array(64).fill(0).flatMap((_, i) => {
                    const angle = (i / 64) * Math.PI * 2;
                    return [Math.cos(angle) * radius, Math.sin(angle) * radius, 0];
                }),
                3
            )),
            new THREE.LineBasicMaterial({ color, transparent: true, opacity })
        );
        return ring;
    }

    handleStructurePointerClick(event) {
        if (!this.subatomicMode || !this.structureCanvas) return;
        const rect = this.structureCanvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.structureCamera);
        const intersects = this.raycaster.intersectObjects(this.subatomicMeshes, true);
        if (intersects.length) {
            const hit = intersects[0].object;
            const particleGroup = this.findParentParticleGroup(hit);
            if (particleGroup) {
                this.explodeParticleGroup(particleGroup);
            }
        }
    }

    findParentParticleGroup(object) {
        let current = object;
        while (current) {
            if (current.userData && current.userData.particleType) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    explodeParticleGroup(group) {
        if (!group || !group.userData || this.subatomicExploded[group.userData.particleType]) {
            return;
        }
        const type = group.userData.particleType;
        const outer = group.userData.outerMesh;
        const internals = group.userData.internals;
        if (!outer || !internals) return;

        this.subatomicExploded[type] = true;
        if (internals && !internals.visible) {
            internals.visible = true;
        }

        if (typeof gsap !== 'undefined') {
            const timeline = gsap.timeline();
            timeline.to(outer.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.45, ease: 'power2.out' }, 0);
            if (outer.material) {
                timeline.to(outer.material, { opacity: 0, duration: 0.45, ease: 'power2.out' }, 0);
            }

            internals.children.forEach((child, index) => {
                const delay = 0.25 + index * 0.05;
                child.visible = true;
                if (child.material) {
                    child.material.opacity = 0;
                }
                child.scale.set(0.3, 0.3, 0.3);
                timeline.to(child.scale, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'back.out(2)', delay }, 0);
                if (child.material) {
                    timeline.to(child.material, { opacity: 1, duration: 0.35, ease: 'power1.out', delay }, 0);
                }
            });

            if (type === 'electron') {
                timeline.to(group.rotation, { z: Math.PI * 0.6, duration: 0.8, ease: 'power2.out' }, 0);
            } else {
                timeline.to(group.rotation, { y: Math.PI * 0.9, duration: 0.8, ease: 'power2.out' }, 0);
            }
        } else {
            outer.visible = false;
            internals.children.forEach(child => child.visible = true);
        }

        const title = `${group.userData.title} Expanded`;
        const info = `You have expanded the ${group.userData.title.toLowerCase()}.
Hover its glowing internals to inspect each subatomic particle.`;
        this.updateSubatomicInfo(title, info);
    }

    handleStructurePointerMove(event) {
        if (!this.subatomicMode || !this.structureCanvas) return;
        const rect = this.structureCanvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.structureCamera);
        const intersects = this.raycaster.intersectObjects(this.subatomicMeshes, true);
        if (intersects.length) {
            const hit = intersects[0].object;
            const data = hit.userData || hit.object?.userData;
            if (data && data.title && data.info) {
                this.updateSubatomicInfo(data.title, data.info);
                this.highlightSubatomicObject(hit);
                return;
            }
        }
        this.clearSubatomicHover();
    }

    handleStructurePointerMove(event) {
        if (!this.subatomicMode || !this.structureCanvas) return;
        const rect = this.structureCanvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.structureCamera);
        const intersects = this.raycaster.intersectObjects(this.subatomicMeshes, true);
        if (intersects.length) {
            const hit = intersects[0].object;
            const data = hit.userData || hit.object?.userData;
            if (data && data.title && data.info) {
                this.updateSubatomicInfo(data.title, data.info);
                this.highlightSubatomicObject(hit);
                return;
            }
        }
        this.clearSubatomicHover();
    }

    updateSubatomicInfo(title, info) {
        const titleNode = document.querySelector('.subatomic-info-title');
        const detailNode = document.getElementById('subatomicInfoDetail');
        if (titleNode) titleNode.textContent = title;
        if (detailNode) detailNode.textContent = info;
    }

    highlightSubatomicObject(object) {
        if (this.subatomicHoverTarget === object) return;
        this.resetSubatomicHighlight();

        if (!object || !object.material) return;

        object.userData._originalScale = object.scale.clone();
        object.scale.multiplyScalar(1.2);

        if (object.material.emissive) {
            object.userData._originalEmissiveIntensity = object.material.emissiveIntensity || 0;
            object.material.emissiveIntensity = (object.material.emissiveIntensity || 0.2) + 0.4;
        }

        this.subatomicHoverTarget = object;
    }

    resetSubatomicHighlight() {
        if (!this.subatomicHoverTarget) return;
        const object = this.subatomicHoverTarget;
        if (object.userData._originalScale) {
            object.scale.copy(object.userData._originalScale);
        }
        if (object.material && object.material.emissive && object.userData._originalEmissiveIntensity !== undefined) {
            object.material.emissiveIntensity = object.userData._originalEmissiveIntensity;
        }
        this.subatomicHoverTarget = null;
    }

    clearSubatomicHover() {
        this.resetSubatomicHighlight();
        const titleNode = document.querySelector('.subatomic-info-title');
        const detailNode = document.getElementById('subatomicInfoDetail');
        if (titleNode) titleNode.textContent = 'Particle Detail';
        if (detailNode) detailNode.textContent = 'Hover over an electron, proton, or neutron to inspect its internal structure.';
    }

    createTextSprite(text, options = {}) {
        const fontSize = options.fontSize || 32;
        const padding = options.padding || 4;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `${fontSize}px Arial`;
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        canvas.width = textWidth + padding * 2;
        canvas.height = fontSize + padding * 2;
        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = options.backgroundColor || 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = options.color || '#ffffff';
        ctx.fillText(text, padding, fontSize + padding / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMaterial);
        const scale = (fontSize / 12) * 2.2;
        sprite.scale.set(canvas.width / 20 * scale, canvas.height / 20 * scale, 1);
        return sprite;
    }

    getCategoryKey(category) {
        const map = {
            'alkali metal': 'alkali-metals',
            'alkaline earth metal': 'alkaline-earth',
            'transition metal': 'transition-metals',
            'lanthanoid': 'lanthanides',
            'actinoid': 'actinides',
            'post-transition metal': 'other-metals',
            'metalloid': 'semimetals',
            'nonmetal': 'nonmetals',
            'halogen': 'halogens',
            'noble gas': 'noble-gases',
            'reactive non-metal': 'nonmetals'
        };
        const normalized = (category || '').toString().trim().toLowerCase();
        return map[normalized] || normalized.replace(/\s+/g, '-');
    }

    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'element-tooltip';
        document.body.appendChild(this.tooltip);
    }

    showTooltip(element, event) {
        const atomicNumber = element.atomicNumber || element.number;
        const electronShells = Array.isArray(element.electronShells) && element.electronShells.length
            ? element.electronShells.join(' · ')
            : (typeof generateElectronShells === 'function'
                ? generateElectronShells(atomicNumber).join(' · ')
                : 'N/A');
        const orbitalShells = element.orbitalShells || (typeof generateOrbitalShells === 'function'
            ? generateOrbitalShells(atomicNumber)
            : 'N/A');

        this.tooltip.innerHTML = `
            <div class="tooltip-title">Atomic Structure</div>
            <div class="tooltip-row"><strong>${element.symbol}</strong> — ${element.name}</div>
            <div class="tooltip-row">Atomic #: ${atomicNumber}</div>
            <div class="tooltip-row">Mass: ${element.atomicMass}</div>
            <div class="tooltip-row">Config: ${element.electronConfig || 'N/A'}</div>
            <div class="tooltip-row">Shells: ${electronShells}</div>
            <div class="tooltip-row">Orbitals: ${orbitalShells}</div>
            <div class="tooltip-row">Category: ${this.formatCategory(element.category || '')}</div>
        `;
        this.tooltip.classList.add('active');
        this.moveTooltip(event);
    }

    moveTooltip(event) {
        if (!this.tooltip) return;
        const offsetX = 18;
        const offsetY = -12;
        this.tooltip.style.left = `${event.clientX + offsetX}px`;
        this.tooltip.style.top = `${event.clientY + offsetY}px`;
    }

    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.classList.remove('active');
        }
    }

    selectElement(element) {
        this.selectedElement = element;
        this.updateElementPanel();
        this.showViewer();
        this.initializeThreeJS();
        this.createAtomVisualization(element);
        this.openStructureOverlay();
    }

    updateElementPanel() {
        const el = this.selectedElement;

        document.getElementById('elementName').textContent = el.name;
        document.getElementById('elementSymbol').textContent = el.symbol;
        document.getElementById('atomicNumber').textContent = el.atomicNumber;
        document.getElementById('atomicMass').textContent = el.atomicMass;
        document.getElementById('state').textContent = el.state;
        document.getElementById('category').textContent = this.formatCategory(el.category);
        document.getElementById('electronegativity').textContent = el.electronegativity ? el.electronegativity.toFixed(2) : 'N/A';
        document.getElementById('ionizationEnergy').textContent = el.ionizationEnergy;
        document.getElementById('electronConfig').textContent = el.electronConfig;
        document.getElementById('discoveredBy').textContent = `${el.discovered} (${el.year || 'Ancient'})`;
        document.getElementById('description').textContent = el.description;

        // Research mode data
        const relEffects = el.atomicNumber > 70 ? 'Notable: Core electrons approach relativistic speeds' : 'Minimal';
        document.getElementById('electronVelocity').textContent = `${(el.electronVelocity || 2200).toFixed(0)} km/s`;
        document.getElementById('orbitalShells').textContent = el.orbitalShells || (typeof generateOrbitalShells === 'function'
            ? generateOrbitalShells(el.atomicNumber || el.number)
            : 'K');
        document.getElementById('relativisticNote').textContent = relEffects;

        const researchInfo = document.getElementById('researchInfo');
        if (this.researchMode) {
            researchInfo.style.display = 'block';
        } else {
            researchInfo.style.display = 'none';
        }
    }

    formatCategory(category) {
        return category
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    showViewer() {
        document.getElementById('viewerPanel').classList.add('active');
    }

    closeViewer() {
        document.getElementById('viewerPanel').classList.remove('active');
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
            this.scene = null;
            this.camera = null;
        }
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    initializeThreeJS() {
        const canvas = document.getElementById('threejsCanvas');
        const container = canvas.parentElement;

        const width = container.clientWidth;
        const height = container.clientHeight;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a1a);
        this.scene.fog = new THREE.Fog(0x0a0a1a, 100, 500);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.z = 50;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0x00d9ff, 0.8);
        pointLight1.position.set(50, 50, 50);
        pointLight1.castShadow = true;
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x9d4edd, 0.6);
        pointLight2.position.set(-50, -50, 50);
        this.scene.add(pointLight2);

        // Handle window resize
        const handleResize = () => {
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            this.camera.aspect = newWidth / newHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(newWidth, newHeight);
        };

        window.addEventListener('resize', handleResize);

        // Start animation loop
        this.animate();
    }

    createAtomVisualization(element) {
        if (this.atomVisualization) {
            this.scene.remove(this.atomVisualization);
        }

        this.atomVisualization = new THREE.Group();

        // Nucleus
        const nucleusGeometry = new THREE.SphereGeometry(3, 32, 32);
        const nucleusMaterial = new THREE.MeshStandardMaterial({
            color: 0xff006e,
            emissive: 0xff006e,
            emissiveIntensity: 0.5,
            metalness: 0.7,
            roughness: 0.2
        });
        const nucleus = new THREE.Mesh(nucleusGeometry, nucleusMaterial);
        nucleus.castShadow = true;
        this.atomVisualization.add(nucleus);

        // Add glow effect to nucleus
        const glowGeometry = new THREE.SphereGeometry(3.5, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xff006e,
            transparent: true,
            opacity: 0.15
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.atomVisualization.add(glow);

        // Create electron shells
        const shells = Array.isArray(element.electronShells) && element.electronShells.length
            ? element.electronShells
            : (typeof generateElectronShells === 'function'
                ? generateElectronShells(element.atomicNumber || element.number)
                : [1]);
        const shellRadius = [15, 25, 35, 45, 55, 65, 75];
        const colors = [0x00d9ff, 0x9d4edd, 0x3a0ca3, 0xff006e, 0xffc300, 0xc1121f, 0x8ecae6];

        shells.forEach((electronCount, shellIndex) => {
            if (shellIndex >= shellRadius.length) return;

            const radius = shellRadius[shellIndex];
            const color = colors[shellIndex % colors.length];

            // Draw orbital path
            if (this.researchMode) {
                const orbitGeometry = new THREE.BufferGeometry();
                const orbitPoints = [];
                for (let i = 0; i <= 64; i++) {
                    const angle = (i / 64) * Math.PI * 2;
                    orbitPoints.push(
                        Math.cos(angle) * radius,
                        Math.sin(angle) * radius,
                        0
                    );
                }
                orbitGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(orbitPoints), 3));
                const orbitMaterial = new THREE.LineBasicMaterial({ color, linewidth: 1, transparent: true, opacity: 0.4 });
                const orbit = new THREE.Line(orbitGeometry, orbitMaterial);
                this.atomVisualization.add(orbit);
            }

            // Add electrons
            for (let i = 0; i < electronCount; i++) {
                const angle = (i / electronCount) * Math.PI * 2;
                const electronGeometry = new THREE.SphereGeometry(1.2, 16, 16);
                const electronMaterial = new THREE.MeshStandardMaterial({
                    color,
                    emissive: color,
                    emissiveIntensity: 0.6,
                    metalness: 0.5,
                    roughness: 0.4
                });
                const electron = new THREE.Mesh(electronGeometry, electronMaterial);

                // Store animation parameters
                electron.userData = {
                    shellIndex,
                    electronIndex: i,
                    electronCount,
                    baseAngle: angle,
                    radius,
                    color,
                    orbitSpeed: 0.01 + (shellIndex * 0.005),
                    orbitPlane: shellIndex % 3 // Vary orbital planes
                };

                this.atomVisualization.add(electron);
            }
        });

        this.scene.add(this.atomVisualization);
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        if (!this.atomVisualization || !this.selectedElement) return;

        // Rotate nucleus and glow
        const nucleus = this.atomVisualization.children[0];
        nucleus.rotation.x += 0.002;
        nucleus.rotation.y += 0.003;

        const glow = this.atomVisualization.children[1];
        glow.rotation.x += 0.001;
        glow.rotation.y += 0.002;
        glow.scale.x = 1 + 0.1 * Math.sin(Date.now() * 0.005);
        glow.scale.y = glow.scale.x;
        glow.scale.z = glow.scale.x;

        // Animate electrons
        const time = Date.now() * 0.0005;
        for (let i = 2; i < this.atomVisualization.children.length; i++) {
            const electron = this.atomVisualization.children[i];
            const userData = electron.userData;

            if (userData) {
                const angle = userData.baseAngle + time * userData.orbitSpeed;
                const planeOffset = userData.orbitPlane;

                electron.position.x = Math.cos(angle) * userData.radius;
                electron.position.y = Math.sin(angle + planeOffset) * userData.radius;
                electron.position.z = Math.sin(angle * 0.7 + planeOffset * 0.5) * (userData.radius * 0.3);

                // Vary electron size based on position
                const scaleVariation = 1 + 0.2 * Math.sin(time * 0.5 + i);
                electron.scale.set(scaleVariation, scaleVariation, scaleVariation);
            }
        }

        // Rotate entire atom group
        this.atomVisualization.rotation.x += 0.0002;
        this.atomVisualization.rotation.y += 0.0003;

        this.renderer.render(this.scene, this.camera);
    }

    hideLoadingIndicator() {
        const loader = document.getElementById('loadingIndicator');
        setTimeout(() => {
            loader.classList.add('hidden');
        }, 800);
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AtomVerse();
});

// Handle window resize for responsive layout
window.addEventListener('resize', () => {
    if (document.getElementById('threejsCanvas').parentElement) {
        const canvas = document.getElementById('threejsCanvas');
        if (canvas && canvas.parentElement && canvas.parentElement.clientWidth > 0) {
            // Three.js will handle resizing in the animate loop
        }
    }
});
