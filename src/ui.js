// src/ui.js

/**
 * Perform a Delta Update on a table body to prevent full DOM re-renders.
 * It matches rows by a unique ID (e.g., sector name or stock symbol) and updates
 * only the cells that have changed. It also handles reordering rows smoothly.
 * 
 * @param {HTMLElement} tbody - The table body element
 * @param {Array} data - The sorted array of data objects
 * @param {Function} getRowId - Function that takes a data object and returns a unique ID string
 * @param {Function} updateRow - Function that takes a tr element and a data object, and updates the tr's content
 */
const renderQueue = new Map();

export function updateTableDelta(tbody, data, getRowId, updateRow) {
  // Cancel any pending progressive render for this specific table body
  if (renderQueue.has(tbody)) {
    cancelAnimationFrame(renderQueue.get(tbody));
    renderQueue.delete(tbody);
  }

  const existingRows = Array.from(tbody.children);
  const rowMap = new Map();
  
  // Map existing rows by their data-id
  existingRows.forEach(tr => {
    if (tr.getAttribute('data-ignore') === 'true') {
      return; // Keep ignored rows
    }
    const id = tr.getAttribute('data-id');
    if (id) {
      rowMap.set(id, tr);
    } else {
      // Remove placeholder rows (like "Loading...")
      tbody.removeChild(tr);
    }
  });

  const chunkSize = 20; // Number of rows to render per animation frame
  let currentIndex = 0;

  function renderChunk() {
    const end = Math.min(currentIndex + chunkSize, data.length);
    for (let i = currentIndex; i < end; i++) {
      const d = data[i];
      const id = getRowId(d);
      let tr = rowMap.get(id);

      if (!tr) {
        // Create new row
        tr = document.createElement('tr');
        tr.setAttribute('data-id', id);
        tbody.appendChild(tr);
      } else {
        // Remove from map so we know it's processed
        rowMap.delete(id);
      }

      // Ensure row is in correct order in the DOM
      if (tbody.children[i] !== tr) {
        tbody.insertBefore(tr, tbody.children[i]);
      }

      // Update row contents (only triggers flash if values change)
      updateRow(tr, d, i);
    }

    currentIndex = end;

    if (currentIndex < data.length) {
      // Schedule next chunk
      renderQueue.set(tbody, requestAnimationFrame(renderChunk));
    } else {
      // Finished all chunks, remove any remaining rows that are no longer in the data
      rowMap.forEach(tr => {
        tbody.removeChild(tr);
      });
      renderQueue.delete(tbody);
    }
  }

  // Execute the first chunk immediately synchronously to prevent visual blanking/stutter
  renderChunk();
}

/**
 * Triggers a flash animation on an element if the new value differs from the old value.
 * @param {HTMLElement} tr - The table row element
 * @param {string|number} oldValue - The previous value (e.g. price or amount)
 * @param {string|number} newValue - The new value
 */
export function triggerFlashIfChanged(tr, oldValue, newValue) {
  if (oldValue !== undefined && newValue !== undefined && oldValue !== newValue) {
    tr.classList.remove('flash-up', 'flash-down');
    // Force DOM reflow to restart animation
    void tr.offsetWidth;
    if (Number(newValue) > Number(oldValue)) {
      tr.classList.add('flash-up');
    } else {
      tr.classList.add('flash-down');
    }
    
    // Cleanup class after animation ends
    setTimeout(() => {
      tr.classList.remove('flash-up', 'flash-down');
    }, 1000);
  }
}
