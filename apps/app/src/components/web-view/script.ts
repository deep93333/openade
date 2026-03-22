export const getInspectorScript = (enabled: boolean) => `
(function() {
  const INSPECTOR_ID = '__openade_inspector__';
  
  // Clean up existing inspector
  const existingOverlay = document.getElementById(INSPECTOR_ID);
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Remove existing styles
  const existingStyles = document.getElementById(INSPECTOR_ID + '_styles');
  if (existingStyles) {
    existingStyles.remove();
  }
  
  // Clean up event listeners
  if (window.__openadeInspectorCleanup) {
    window.__openadeInspectorCleanup();
    delete window.__openadeInspectorCleanup;
  }
  
  if (!${enabled}) return;
  
  // Add styles
  const styles = document.createElement('style');
  styles.id = INSPECTOR_ID + '_styles';
  styles.textContent = \`
    .__openade_highlight__ {
      outline: 2px solid #3b82f6 !important;
      outline-offset: 2px !important;
      background-color: rgba(59, 130, 246, 0.1) !important;
    }
    .__openade_selected__ {
      outline: 2px solid #10b981 !important;
      outline-offset: 2px !important;
      background-color: rgba(16, 185, 129, 0.1) !important;
    }
    #__openade_tooltip__ {
      position: fixed;
      z-index: 2147483647;
      background: #1f2937;
      color: #f9fafb;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
      pointer-events: none;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #__openade_tooltip__ .tag { color: #f472b6; }
    #__openade_tooltip__ .class { color: #a5b4fc; }
    #__openade_tooltip__ .id { color: #fbbf24; }
    #__openade_tooltip__ .react { color: #67e8f9; }
    #__openade_tooltip__ .dims { color: #9ca3af; margin-left: 8px; }
  \`;
  document.head.appendChild(styles);
  
  // Create tooltip
  const tooltip = document.createElement('div');
  tooltip.id = '__openade_tooltip__';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);
  
  let hoveredElement = null;
  let selectedElement = null;
  
  function getReactFiber(element) {
    const keys = Object.keys(element);
    const fiberKey = keys.find(key => 
      key.startsWith('__reactFiber$') || 
      key.startsWith('__reactInternalInstance$')
    );
    return fiberKey ? element[fiberKey] : null;
  }
  
  function getReactComponentName(element) {
    const fiber = getReactFiber(element);
    if (!fiber) return null;
    
    let current = fiber;
    while (current) {
      if (current.type) {
        if (typeof current.type === 'function') {
          return current.type.displayName || current.type.name || null;
        }
        if (typeof current.type === 'object' && current.type.$$typeof) {
          const innerType = current.type.type || current.type.render;
          if (innerType) {
            return innerType.displayName || innerType.name || null;
          }
        }
      }
      current = current.return;
    }
    return null;
  }
  
  function getReactProps(element) {
    const fiber = getReactFiber(element);
    if (!fiber) return null;
    return fiber.memoizedProps || fiber.pendingProps || null;
  }
  
  function getReactSource(element) {
    const fiber = getReactFiber(element);
    if (!fiber) return null;
    
    let current = fiber;
    while (current) {
      if (current._debugSource) {
        return current._debugSource;
      }
      current = current.return;
    }
    return null;
  }
  
  function getUniqueSelector(element) {
    if (element.id) {
      return '#' + CSS.escape(element.id);
    }
    
    const path = [];
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector = '#' + CSS.escape(current.id);
        path.unshift(selector);
        break;
      }
      
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\\s+/).filter(c => c && !c.startsWith('__openade'));
        if (classes.length > 0) {
          selector += '.' + classes.slice(0, 2).map(c => CSS.escape(c)).join('.');
        }
      }
      
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          el => el.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += ':nth-of-type(' + index + ')';
        }
      }
      
      path.unshift(selector);
      current = parent;
      
      if (path.length > 4) break;
    }
    
    return path.join(' > ');
  }
  
  function getElementInfo(element) {
    const tagName = element.tagName.toLowerCase();
    const id = element.id || null;
    const classList = element.className && typeof element.className === 'string' 
      ? element.className.trim().split(/\\s+/).filter(c => c && !c.startsWith('__openade'))
      : [];
    const rect = element.getBoundingClientRect();
    const selector = getUniqueSelector(element);
    const reactComponent = getReactComponentName(element);
    const reactProps = getReactProps(element);
    const reactSource = getReactSource(element);
    
    const computedStyle = window.getComputedStyle(element);
    const styles = {
      display: computedStyle.display,
      position: computedStyle.position,
      fontSize: computedStyle.fontSize,
      color: computedStyle.color,
      backgroundColor: computedStyle.backgroundColor,
    };
    
    const attributes = {};
    for (const attr of element.attributes) {
      if (!attr.name.startsWith('__react')) {
        attributes[attr.name] = attr.value;
      }
    }
    
    return {
      tagName,
      id,
      classList,
      selector,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      attributes,
      styles,
      textContent: element.textContent?.slice(0, 100)?.trim() || null,
      react: {
        component: reactComponent,
        props: reactProps ? Object.keys(reactProps).filter(k => !k.startsWith('__')) : null,
        source: reactSource,
      },
    };
  }
  
  function updateTooltip(element, x, y) {
    if (!element) {
      tooltip.style.display = 'none';
      return;
    }
    
    const info = getElementInfo(element);
    const rect = info.rect;
    
    let html = '<span class="tag">&lt;' + info.tagName + '&gt;</span>';
    if (info.id) {
      html += ' <span class="id">#' + info.id + '</span>';
    }
    if (info.classList.length > 0) {
      html += ' <span class="class">.' + info.classList.slice(0, 3).join('.') + '</span>';
    }
    if (info.react.component) {
      html += ' <span class="react">&lt;' + info.react.component + '/&gt;</span>';
    }
    if (info.react.source && info.react.source.fileName) {
      const fileName = info.react.source.fileName.split(/[/\\\\]/).pop() || info.react.source.fileName;
      html += ' <span class="dims">' + fileName + ':' + info.react.source.lineNumber + '</span>';
    }
    html += '<span class="dims">' + rect.width + '×' + rect.height + '</span>';
    
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    
    const tooltipRect = tooltip.getBoundingClientRect();
    let left = x + 12;
    let top = y + 12;
    
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = x - tooltipRect.width - 12;
    }
    if (top + tooltipRect.height > window.innerHeight - 10) {
      top = y - tooltipRect.height - 12;
    }
    
    tooltip.style.left = Math.max(10, left) + 'px';
    tooltip.style.top = Math.max(10, top) + 'px';
  }
  
  function handleMouseMove(e) {
    const target = e.target;
    if (target === tooltip || target.id === INSPECTOR_ID) return;
    
    if (hoveredElement && hoveredElement !== selectedElement) {
      hoveredElement.classList.remove('__openade_highlight__');
    }
    
    hoveredElement = target;
    if (target !== selectedElement) {
      target.classList.add('__openade_highlight__');
    }
    
    updateTooltip(target, e.clientX, e.clientY);
  }
  
  function handleMouseLeave() {
    if (hoveredElement && hoveredElement !== selectedElement) {
      hoveredElement.classList.remove('__openade_highlight__');
    }
    hoveredElement = null;
    tooltip.style.display = 'none';
  }
  
  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target;
    if (target === tooltip || target.id === INSPECTOR_ID) return;
    
    if (selectedElement) {
      selectedElement.classList.remove('__openade_selected__');
    }
    
    selectedElement = target;
    target.classList.remove('__openade_highlight__');
    target.classList.add('__openade_selected__');
    
    const info = getElementInfo(target);
    
    // Send message via console (picked up by webview console-message event)
    console.log('__openade_' + JSON.stringify({
      type: 'element_selected',
      data: info,
    }));
  }
  
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (selectedElement) {
        selectedElement.classList.remove('__openade_selected__');
        selectedElement = null;
      }
      console.log('__openade_' + JSON.stringify({
        type: 'inspector_cancel',
      }));
    }
  }
  
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('mouseleave', handleMouseLeave, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  
  window.__openadeInspectorCleanup = function() {
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('mouseleave', handleMouseLeave, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    
    if (hoveredElement) {
      hoveredElement.classList.remove('__openade_highlight__');
    }
    if (selectedElement) {
      selectedElement.classList.remove('__openade_selected__');
    }
    
    tooltip.remove();
    styles.remove();
  };
})();
`;
