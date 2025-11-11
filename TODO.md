# TODO: Modify Marine Species App for Snapshot Capture and Functional Flash

## Steps to Complete:
1. **Edit index.html**: Add a hidden canvas element for capturing snapshots from the video feed.
2. **Edit app.js**: 
   - Remove the continuous predictLoop and live prediction.
   - Add event listeners for capture button (📸), flash button (⚡), and gallery button (🖼️).
   - Implement capture function: On capture click, draw video frame to canvas, predict on the image, update #species-name with common name (infoData[species].common), and update info panel.
   - Implement flash functionality: Toggle device's flashlight/torch on flash button click (if supported via MediaStream constraints). If not supported, fall back to screen flash simulation.
   - On capture, if flash is enabled, briefly enable torch or flash screen.
   - Keep gallery and add to collection as basic alerts for now.
3. **Test the app**: Run in browser, ensure camera opens, capture works, common name displays, flash toggles/toggles torch.
4. **Followup**: If issues with torch, refine flash to screen flash only.

## Progress:
- [x] Step 1: Edit index.html
- [x] Step 2: Edit app.js
- [x] Step 3: Test app
- [ ] Step 4: Followup refinements
