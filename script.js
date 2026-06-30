document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('imageUpload');
    const fileName = document.getElementById('fileName');
    const recipientName = document.getElementById('recipientName');
    const verticalPos = document.getElementById('verticalPos');
    const horizontalPos = document.getElementById('horizontalPos');
    const fontSize = document.getElementById('fontSize');
    const fontFamily = document.getElementById('fontFamily');
    const textColor = document.getElementById('textColor');
    const downloadBtn = document.getElementById('downloadBtn');

    // Bulk elements
    const bulkNames = document.getElementById('bulkNames');
    const bulkCount = document.getElementById('bulkCount');
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    const bulkProgress = document.getElementById('bulkProgress');
    const progressFill = document.getElementById('progressFill');
    const progressLabel = document.getElementById('progressLabel');

    // Tab elements
    const tabSingle = document.getElementById('tabSingle');
    const tabBulk = document.getElementById('tabBulk');
    const panelSingle = document.getElementById('panelSingle');
    const panelBulk = document.getElementById('panelBulk');

    const canvas = document.getElementById('certificateCanvas');
    const ctx = canvas.getContext('2d');
    const placeholder = document.getElementById('placeholder');

    let templateImage = null;
    let currentMode = 'single';

    // ─── Tab switching ────────────────────────────────────────────────────────
    [tabSingle, tabBulk].forEach(btn => {
        btn.addEventListener('click', () => {
            currentMode = btn.dataset.tab;
            tabSingle.classList.toggle('active', currentMode === 'single');
            tabBulk.classList.toggle('active', currentMode === 'bulk');
            panelSingle.style.display = currentMode === 'single' ? 'flex' : 'none';
            panelBulk.style.display = currentMode === 'bulk' ? 'flex' : 'none';
            // Redraw preview with correct name
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
                    canvas.width = img.width;
                    canvas.height = img.height;
                    canvas.style.display = 'block';
                    placeholder.style.display = 'none';
                    downloadBtn.disabled = false;
                    updateZipBtnState();
                    drawCertificate();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // ─── Draw function ────────────────────────────────────────────────────────
    function drawCertificate(nameOverride) {
        if (!templateImage) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(templateImage, 0, 0);

        const name = nameOverride !== undefined
            ? nameOverride
            : (currentMode === 'single' ? recipientName.value.trim() : getFirstBulkName());

        if (!name) return;

        const size = fontSize.value;
        const font = fontFamily.value;
        const color = textColor.value;
        const yPosPercent = verticalPos.value / 100;
        const yPos = canvas.height * yPosPercent;
        const xPosPercent = horizontalPos.value / 100;
        const xPos = canvas.width * xPosPercent;

        ctx.font = `${size}px ${font}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(name, xPos, yPos);
    }

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

    // ─── Bulk name counter ────────────────────────────────────────────────────
    bulkNames.addEventListener('input', () => {
        const names = parseBulkNames();
        bulkCount.textContent = `${names.length} name${names.length !== 1 ? 's' : ''} entered`;
        updateZipBtnState();
        drawCertificate(); // preview first name
    });

    function updateZipBtnState() {
        const hasTemplate = !!templateImage;
        const hasNames = parseBulkNames().length > 0;
        downloadZipBtn.disabled = !(hasTemplate && hasNames);
    }

    // ─── Shared input listeners ───────────────────────────────────────────────
    const sharedInputs = [verticalPos, horizontalPos, fontSize, fontFamily, textColor];
    sharedInputs.forEach(input => input.addEventListener('input', drawCertificate));
    recipientName.addEventListener('input', drawCertificate);

    // Enter key on single mode
    recipientName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (templateImage && recipientName.value.trim()) downloadCertificate();
        }
    });

    // ─── Single download ──────────────────────────────────────────────────────
    function downloadCertificate() {
        if (!templateImage) return;
        const name = recipientName.value.trim() || 'Certificate';
        const safeName = name.replace(/\s+/g, '_');
        const link = document.createElement('a');
        link.download = `${safeName}_Certificate.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    downloadBtn.addEventListener('click', downloadCertificate);

    // ─── Bulk ZIP download ────────────────────────────────────────────────────
    downloadZipBtn.addEventListener('click', async () => {
        const names = parseBulkNames();
        if (!templateImage || names.length === 0) return;

        const { jsPDF } = window.jspdf;

        // Show progress
        bulkProgress.style.display = 'flex';
        downloadZipBtn.disabled = true;
        downloadZipBtn.textContent = 'Generating…';

        const zip = new JSZip();
        const offCanvas = document.createElement('canvas');
        offCanvas.width = canvas.width;
        offCanvas.height = canvas.height;
        const offCtx = offCanvas.getContext('2d');

        // PDF page size: convert canvas px → mm (96 DPI basis)
        const PX_TO_MM = 0.2646;
        const pdfW = offCanvas.width * PX_TO_MM;
        const pdfH = offCanvas.height * PX_TO_MM;
        const pdfOrientation = pdfW >= pdfH ? 'landscape' : 'portrait';

        for (let i = 0; i < names.length; i++) {
            const name = names[i];

            // Draw onto off-screen canvas
            offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
            offCtx.drawImage(templateImage, 0, 0);

            const size = fontSize.value;
            const font = fontFamily.value;
            const color = textColor.value;
            const yPosPercent = verticalPos.value / 100;
            const yPos = offCanvas.height * yPosPercent;
            const xPosPercent = horizontalPos.value / 100;
            const xPos = offCanvas.width * xPosPercent;

            offCtx.font = `${size}px ${font}`;
            offCtx.fillStyle = color;
            offCtx.textAlign = 'center';
            offCtx.textBaseline = 'bottom';
            offCtx.fillText(name, xPos, yPos);

            const safeName = name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');

            // ── PDF only ─────────────────────────────────────────────────────
            const pngData = offCanvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: pdfOrientation,
                unit: 'mm',
                format: [pdfW, pdfH],
                compress: true,
            });
            pdf.addImage(pngData, 'PNG', 0, 0, pdfW, pdfH);
            const pdfBytes = pdf.output('arraybuffer');
            zip.file(`${safeName}.pdf`, pdfBytes);

            // Update progress
            const pct = Math.round(((i + 1) / names.length) * 100);
            progressFill.style.width = `${pct}%`;
            progressLabel.textContent = `${i + 1} / ${names.length} — PDF`;

            // Yield to browser to keep UI responsive
            await new Promise(r => setTimeout(r, 0));
        }

        progressLabel.textContent = 'Compressing ZIP…';
        await new Promise(r => setTimeout(r, 0));

        // Generate and download ZIP
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'certificates.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Reset UI
        bulkProgress.style.display = 'none';
        progressFill.style.width = '0%';
        downloadZipBtn.disabled = false;
        downloadZipBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download ZIP`;
    });
});
