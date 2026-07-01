document.addEventListener('DOMContentLoaded', () => {
    // ─── Ensure Google Fonts are loaded before first canvas render ────────────
    document.fonts.ready.then(() => {
        drawCertificate();
    });

    const imageUpload   = document.getElementById('imageUpload');
    const fileName      = document.getElementById('fileName');
    const recipientName = document.getElementById('recipientName');
    const verticalPos   = document.getElementById('verticalPos');
    const horizontalPos = document.getElementById('horizontalPos');
    const fontSize      = document.getElementById('fontSize');
    const fontFamily    = document.getElementById('fontFamily');
    const textColor     = document.getElementById('textColor');
    const downloadBtn   = document.getElementById('downloadBtn');
    const singleFileName   = document.getElementById('singleFileName');
    const singleFilePreview = document.getElementById('singleFilePreview');

    // Bulk elements
    const bulkNames      = document.getElementById('bulkNames');
    const bulkCount      = document.getElementById('bulkCount');
    const bulkFileName   = document.getElementById('bulkFileName');
    const bulkFilePreview  = document.getElementById('bulkFilePreview');
    const bulkFolderName   = document.getElementById('bulkFolderName');
    const bulkFolderPreview = document.getElementById('bulkFolderPreview');
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    const bulkProgress  = document.getElementById('bulkProgress');
    const progressFill  = document.getElementById('progressFill');
    const progressLabel = document.getElementById('progressLabel');

    // Tab elements
    const tabSingle  = document.getElementById('tabSingle');
    const tabBulk    = document.getElementById('tabBulk');
    const panelSingle = document.getElementById('panelSingle');
    const panelBulk  = document.getElementById('panelBulk');

    const canvas = document.getElementById('certificateCanvas');
    const ctx    = canvas.getContext('2d');
    const placeholder = document.getElementById('placeholder');

    let templateImage = null;
    let currentMode   = 'single';

    // ─── Text position state (in canvas pixels) ───────────────────────────────
    // Initialised from slider defaults; kept in sync both ways.
    let textX = null; // null = use slider until image is loaded
    let textY = null;

    // ─── Drag state ───────────────────────────────────────────────────────────
    let isDragging     = false;
    let dragOffsetX    = 0;
    let dragOffsetY    = 0;
    let isHoveringText = false;

    // ─── Bulk cursor-tracking preview name ───────────────────────────────────
    let bulkPreviewName = null; // null = use first name fallback

    // ─── Tab switching ────────────────────────────────────────────────────────
    [tabSingle, tabBulk].forEach(btn => {
        btn.addEventListener('click', () => {
            currentMode = btn.dataset.tab;
            tabSingle.classList.toggle('active', currentMode === 'single');
            tabBulk.classList.toggle('active', currentMode === 'bulk');
            panelSingle.style.display = currentMode === 'single' ? 'flex' : 'none';
            panelBulk.style.display   = currentMode === 'bulk'   ? 'flex' : 'none';
            bulkPreviewName = null;
            drawCertificate();
        });
    });

    // ─── Image Upload ─────────────────────────────────────────────────────────
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileName.textContent = file.name;
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    templateImage = img;
                    canvas.width  = img.width;
                    canvas.height = img.height;
                    canvas.style.display = 'block';
                    placeholder.style.display = 'none';
                    downloadBtn.disabled = false;
                    updateZipBtnState();
                    // Seed position from sliders on first load
                    textX = canvas.width  * (horizontalPos.value / 100);
                    textY = canvas.height * (verticalPos.value   / 100);
                    drawCertificate();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // ─── Helpers: canvas → slider sync ───────────────────────────────────────
    function syncSlidersFromPosition() {
        if (!templateImage) return;
        horizontalPos.value = Math.round((textX / canvas.width)  * 100);
        verticalPos.value   = Math.round((textY / canvas.height) * 100);
    }

    function syncPositionFromSliders() {
        if (!templateImage) return;
        textX = canvas.width  * (horizontalPos.value / 100);
        textY = canvas.height * (verticalPos.value   / 100);
    }

    // ─── Draw function ────────────────────────────────────────────────────────
    function getTextMetrics(name) {
        const size  = fontSize.value;
        const font  = fontFamily.value;
        ctx.font = `${size}px ${font}`;
        ctx.textBaseline = 'bottom';
        const metrics = ctx.measureText(name);
        return {
            width:  metrics.width,
            height: parseInt(size, 10),
        };
    }

    function drawCertificate(nameOverride) {
        if (!templateImage) return;

        // Initialise position if not yet set
        if (textX === null) { textX = canvas.width  * (horizontalPos.value / 100); }
        if (textY === null) { textY = canvas.height * (verticalPos.value   / 100); }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(templateImage, 0, 0);

        const name = nameOverride !== undefined
            ? nameOverride
            : (currentMode === 'single'
                ? recipientName.value.trim()
                : (bulkPreviewName !== null ? bulkPreviewName : getFirstBulkName()));

        if (!name) return;

        const size   = fontSize.value;
        const font   = fontFamily.value;
        const color  = textColor.value;

        ctx.font         = `${size}px ${font}`;
        ctx.fillStyle    = color;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'bottom';

        const textWidth  = ctx.measureText(name).width;
        const drawX      = textX - textWidth / 2;
        const drawY      = textY;

        // Hover / drag highlight
        if (isHoveringText || isDragging) {
            const pad = 8;
            const textH = parseInt(size, 10);
            ctx.save();
            ctx.strokeStyle = 'rgba(46,125,50,0.7)';
            ctx.lineWidth   = Math.max(2, canvas.width / 400);
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(drawX - pad, drawY - textH - pad, textWidth + pad * 2, textH + pad * 2);
            ctx.restore();
        }

        ctx.fillText(name, drawX, drawY);
    }

    // ─── Canvas drag-to-position ──────────────────────────────────────────────
    /** Convert a mouse/touch event to canvas-space coordinates */
    function eventToCanvas(e) {
        const rect  = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top)  * scaleY,
        };
    }

    function getActiveName() {
        if (currentMode === 'single') return recipientName.value.trim();
        return bulkPreviewName !== null ? bulkPreviewName : getFirstBulkName();
    }

    function isNearText(cx, cy) {
        if (!templateImage) return false;
        const name = getActiveName();
        if (!name) return false;
        const { width, height } = getTextMetrics(name);
        const drawX = textX - width / 2;
        const drawY = textY;
        const pad   = 16;
        return cx >= drawX - pad && cx <= drawX + width + pad
            && cy >= drawY - height - pad && cy <= drawY + pad;
    }

    canvas.addEventListener('mousedown', (e) => {
        if (!templateImage) return;
        const { x, y } = eventToCanvas(e);
        if (isNearText(x, y)) {
            isDragging  = true;
            dragOffsetX = x - textX;
            dragOffsetY = y - textY;
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!templateImage) return;
        const { x, y } = eventToCanvas(e);

        if (isDragging) {
            textX = x - dragOffsetX;
            textY = y - dragOffsetY;
            syncSlidersFromPosition();
            drawCertificate();
            return;
        }

        const wasHovering = isHoveringText;
        isHoveringText = isNearText(x, y);
        canvas.style.cursor = isHoveringText ? 'grab' : (templateImage ? 'crosshair' : 'default');
        if (wasHovering !== isHoveringText) drawCertificate();
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            canvas.style.cursor = isHoveringText ? 'grab' : 'crosshair';
        }
    });

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
        if (!templateImage) return;
        const { x, y } = eventToCanvas(e);
        if (isNearText(x, y)) {
            isDragging  = true;
            dragOffsetX = x - textX;
            dragOffsetY = y - textY;
            e.preventDefault();
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const { x, y } = eventToCanvas(e);
        textX = x - dragOffsetX;
        textY = y - dragOffsetY;
        syncSlidersFromPosition();
        drawCertificate();
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', () => { isDragging = false; });

    // ─── Bulk name helpers ────────────────────────────────────────────────────
    function getFirstBulkName() {
        const names = parseBulkNames();
        return names.length > 0 ? names[0] : '';
    }

    function parseBulkNames() {
        return bulkNames.value
            .split('\n')
            .map(n => n.trim())
            .filter(n => n.length > 0);
    }

    // ─── Bulk: cursor-line tracking ───────────────────────────────────────────
    function getNameAtCursor() {
        const pos   = bulkNames.selectionStart;
        const text  = bulkNames.value;
        // Find which line the caret is on
        const before = text.substring(0, pos);
        const lineIndex = before.split('\n').length - 1;
        const lines = text.split('\n');
        const lineName = (lines[lineIndex] || '').trim();
        return lineName || null;
    }

    function updateBulkCursorPreview() {
        if (currentMode !== 'bulk') return;
        const name = getNameAtCursor();
        bulkPreviewName = name; // null → fall back to first name
        drawCertificate();
    }

    ['keyup', 'click', 'mouseup'].forEach(evt => {
        bulkNames.addEventListener(evt, updateBulkCursorPreview);
    });

    // ─── Bulk name counter ────────────────────────────────────────────────────
    bulkNames.addEventListener('input', () => {
        const names = parseBulkNames();
        bulkCount.textContent = `${names.length} name${names.length !== 1 ? 's' : ''} entered`;
        updateZipBtnState();
        updateBulkPreview();
        updateBulkCursorPreview();
    });

    function updateZipBtnState() {
        const hasTemplate = !!templateImage;
        const hasNames    = parseBulkNames().length > 0;
        downloadZipBtn.disabled = !(hasTemplate && hasNames);
    }

    // ─── Shared slider / style listeners ─────────────────────────────────────
    const sharedInputs = [fontSize, fontFamily, textColor];
    sharedInputs.forEach(input => input.addEventListener('input', drawCertificate));

    // Sliders update position state then redraw
    horizontalPos.addEventListener('input', () => { syncPositionFromSliders(); drawCertificate(); });
    verticalPos.addEventListener('input',   () => { syncPositionFromSliders(); drawCertificate(); });

    recipientName.addEventListener('input', () => { updateSinglePreview(); drawCertificate(); });

    // Live preview for single file name
    singleFileName.addEventListener('input', updateSinglePreview);
    function updateSinglePreview() {
        const name   = recipientName.value.trim();
        const suffix = singleFileName.value.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
        const safeName  = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '') || 'Certificate';
        const finalName = suffix ? `${safeName}_${suffix}` : safeName;
        singleFilePreview.textContent = name ? `📄 ${finalName}.pdf` : '';
    }

    // Live preview for bulk file name
    bulkFileName.addEventListener('input', updateBulkPreview);
    function updateBulkPreview() {
        const names  = parseBulkNames();
        const suffix = bulkFileName.value.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
        if (names.length === 0) { bulkFilePreview.textContent = ''; return; }
        const firstName = names[0].replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '') || 'Certificate';
        const firstFile = suffix ? `${firstName}_${suffix}.pdf` : `${firstName}.pdf`;
        bulkFilePreview.textContent = names.length > 1
            ? `📄 e.g. ${firstFile} … (${names.length} files)`
            : `📄 ${firstFile}`;
    }

    // Live preview for bulk folder / zip name
    bulkFolderName.addEventListener('input', updateFolderPreview);
    function updateFolderPreview() {
        const raw    = bulkFolderName.value.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
        const folder = raw || 'certificates';
        bulkFolderPreview.textContent = `📦 ${folder}.zip  →  ${folder}/`;
    }

    // Enter key on single mode
    recipientName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (templateImage && recipientName.value.trim()) downloadCertificate();
        }
    });

    // ─── Single download (PDF) ────────────────────────────────────────────────
    function downloadCertificate() {
        if (!templateImage) return;
        const { jsPDF } = window.jspdf;
        const name     = recipientName.value.trim() || 'Certificate';
        const safeName = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '') || 'Certificate';
        const suffix   = singleFileName.value.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
        const finalName = suffix ? `${safeName}_${suffix}` : safeName;
        const pngData  = canvas.toDataURL('image/png');
        const PX_TO_MM = 0.2646;
        const pdfW     = canvas.width  * PX_TO_MM;
        const pdfH     = canvas.height * PX_TO_MM;
        const orientation = pdfW >= pdfH ? 'landscape' : 'portrait';
        const pdf = new jsPDF({ orientation, unit: 'mm', format: [pdfW, pdfH], compress: true });
        pdf.addImage(pngData, 'PNG', 0, 0, pdfW, pdfH);
        pdf.save(`${finalName}.pdf`);
    }

    downloadBtn.addEventListener('click', downloadCertificate);

    // ─── Bulk ZIP download ────────────────────────────────────────────────────
    downloadZipBtn.addEventListener('click', async () => { try {
        const names = parseBulkNames();
        if (!templateImage || names.length === 0) return;

        const { jsPDF } = window.jspdf;

        bulkProgress.style.display = 'flex';
        downloadZipBtn.disabled    = true;
        downloadZipBtn.textContent = 'Generating…';

        const zip = new JSZip();
        const offCanvas = document.createElement('canvas');
        offCanvas.width  = canvas.width;
        offCanvas.height = canvas.height;
        const offCtx = offCanvas.getContext('2d');

        const PX_TO_MM     = 0.2646;
        const pdfW         = offCanvas.width  * PX_TO_MM;
        const pdfH         = offCanvas.height * PX_TO_MM;
        const pdfOrientation = pdfW >= pdfH ? 'landscape' : 'portrait';

        for (let i = 0; i < names.length; i++) {
            const name = names[i];

            offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
            offCtx.drawImage(templateImage, 0, 0);

            const size   = fontSize.value;
            const font   = fontFamily.value;
            const color  = textColor.value;

            offCtx.font         = `${size}px ${font}`;
            offCtx.fillStyle    = color;
            offCtx.textAlign    = 'left';
            offCtx.textBaseline = 'bottom';
            const tw = offCtx.measureText(name).width;
            // Use the same textX/textY position as the live canvas
            offCtx.fillText(name, textX - tw / 2, textY);

            const safePersonName = name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '') || 'Certificate';
            const bulkSuffix     = bulkFileName.value.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
            const safeName       = bulkSuffix ? `${safePersonName}_${bulkSuffix}` : safePersonName;
            const rawFolder      = bulkFolderName.value.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
            const folderPrefix   = rawFolder ? `${rawFolder}/` : '';

            const pngData = offCanvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: pdfOrientation,
                unit: 'mm',
                format: [pdfW, pdfH],
                compress: true,
            });
            pdf.addImage(pngData, 'PNG', 0, 0, pdfW, pdfH);
            const pdfBytes = pdf.output('arraybuffer');
            zip.file(`${folderPrefix}${safeName}.pdf`, pdfBytes);

            const pct = Math.round(((i + 1) / names.length) * 100);
            progressFill.style.width   = `${pct}%`;
            progressLabel.textContent  = `${i + 1} / ${names.length} — PDF`;

            await new Promise(r => setTimeout(r, 0));
        }

        progressLabel.textContent = 'Compressing ZIP…';
        await new Promise(r => setTimeout(r, 0));

        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href  = url;
        const rawFolder  = bulkFolderName.value.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
        const folderName = rawFolder || 'certificates';
        link.download = `${folderName}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        bulkProgress.style.display = 'none';
        progressFill.style.width   = '0%';
        downloadZipBtn.disabled    = false;
        downloadZipBtn.innerHTML   = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download ZIP`;
    } catch (err) {
        console.error('Bulk generation failed:', err);
        alert('Something went wrong generating the ZIP. Please try again.');
        bulkProgress.style.display = 'none';
        progressFill.style.width   = '0%';
        downloadZipBtn.disabled    = false;
        downloadZipBtn.innerHTML   = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download ZIP`;
    }
    });
});
