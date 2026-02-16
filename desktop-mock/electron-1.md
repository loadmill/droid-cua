Here's a summary of the Electron app setup and the problems we solved:                                                                                      
                                                                                                                                                              
  Electron App Initial Setup Summary                                                                                                                          
                                                                                                                                                              
  Stack & Tooling                                                                                                                                             
                                                                                                                                                              
  - electron-vite - Build tool for Electron apps with Vite                                                                                                    
  - React + TypeScript - Frontend                                                                                                                             
  - Electron 30 - Desktop framework                                                                                                                           
                                                                                                                                                              
  Directory Structure                                                                                                                                         
                                                                                                                                                              
  droid-cua-desktop/                                                                                                                                          
  ├── electron.vite.config.ts    # Build configuration                                                                                                        
  ├── package.json               # "type": "module" (ESM)                                                                                                     
  ├── tsconfig.json              # Single unified config                                                                                                      
  ├── src/                                                                                                                                                    
  │   ├── main/                  # Electron main process                                                                                                      
  │   │   └── index.ts           # BrowserWindow, app lifecycle                                                                                               
  │   ├── preload/               # Context bridge (IPC exposure)                                                                                              
  │   │   └── index.ts           # exposeInMainWorld('electronAPI', ...)                                                                                      
  │   ├── renderer/              # React app                                                                                                                  
  │   │   ├── index.html                                                                                                                                      
  │   │   └── src/                                                                                                                                            
  │   └── shared/                # Shared types/constants                                                                                                     
                                                                                                                                                              
  Problems Solved                                                                                                                                             
                                                                                                                                                              
  1. TypeScript Configuration                                                                                                                                 
                                                                                                                                                              
  Problem: Initial setup used project references (tsconfig.node.json, tsconfig.web.json) which caused errors about composite and noEmit settings being        
  incompatible.                                                                                                                                               
                                                                                                                                                              
  Solution: Simplified to a single tsconfig.json with all settings, removed the separate configs.                                                             
                                                                                                                                                              
  2. Preload Script Module Format                                                                                                                             
                                                                                                                                                              
  Problem: The preload script was output as .js but the package.json has "type": "module". Electron's preload uses require() which can't load ES modules,     
  causing:                                                                                                                                                    
  Error [ERR_REQUIRE_ESM]: require() of ES Module .../out/preload/index.js not supported.                                                                     
                                                                                                                                                              
  Solution: Configure electron-vite to output preload as CommonJS with .cjs extension:                                                                        
  // electron.vite.config.ts                                                                                                                                  
  preload: {                                                                                                                                                  
    build: {                                                                                                                                                  
      rollupOptions: {                                                                                                                                        
        output: {                                                                                                                                             
          format: 'cjs',                                                                                                                                      
          entryFileNames: '[name].cjs'                                                                                                                        
        }                                                                                                                                                     
      }                                                                                                                                                       
    }                                                                                                                                                         
  }                                                                                                                                                           
  And update main process to reference ../preload/index.cjs.                                                                                                  
                                                                                                                                                              
  3. macOS Native Titlebar                                                                                                                                    
                                                                                                                                                              
  Configuration: Use titleBarStyle: 'hiddenInset' with traffic light positioning:                                                                             
  new BrowserWindow({                                                                                                                                         
    titleBarStyle: 'hiddenInset',                                                                                                                             
    trafficLightPosition: { x: 20, y: 18 },                                                                                                                   
    // ...                                                                                                                                                    
  })  
                                                                                                                                                        
  The CSS needs padding-top on the sidebar for the titlebar area and -webkit-app-region: drag for draggable regions.                                          

  In the inital atempt we implemented the upper part of the main pane couldn't be interacted with (for example, you could not drag the app window by dragging it). 
  The upper part of the main pain should look lik the main pane in style but actually be a part of an upper line that can be dragged like the upper part of the left side pane.
                                                                                                                                                              
  4. Renderer Process Node.js APIs                                                                                                                            
                                                                                                                                                              
  Problem: Using process.cwd() in the renderer (React) caused errors because Node.js APIs aren't available in the browser context.                            
                                                                                                                                                              
  Solution: Remove Node.js API calls from renderer code; use IPC to get such values from main process if needed.                                              
                                                                                                                                                              
  5. electronAPI Undefined                                                                                                                                    
                                                                                                                                                              
  Problem: window.electronAPI was undefined in the renderer, causing crashes when trying to call IPC methods.                                                 
                                                                                                                                                              
  Solution:                                                                                                                                                   
  1. Fixed the preload module format (problem #2 above)                                                                                                       
  2. Added defensive checks (isElectron flag) in React code to gracefully handle the case where the API isn't available                                       
  3. Show a fallback UI message when not running in proper Electron context                                                                                   
                                                                                                                                                              
  6. DevTools for Debugging                                                                                                                                   
                                                                                                                                                              
  Addition: Open DevTools automatically in dev mode to see console errors:                                                                                    
  if (isDev) {                                                                                                                                                
    mainWindow.webContents.openDevTools()                                                                                                                     
  }                                                                                                                                                           
                                                                                                                                                              
  Key electron-vite Behaviors                                                                                                                                 
                                                                                                                                                              
  - __dirname is automatically polyfilled via import.meta.dirname                                                                                             
  - In dev mode, ELECTRON_RENDERER_URL env var points to the Vite dev server                                                                                  
  - Main and preload are built as SSR bundles, renderer as client bundle                                                                                      
  - externalizeDepsPlugin() keeps Node.js dependencies external (not bundled)   