// Adapter to ensure script.js sees COMPLETE_PERIODIC_TABLE
(function(){
  if (typeof window.COMPLETE_PERIODIC_TABLE === 'undefined' || Object.keys(window.COMPLETE_PERIODIC_TABLE).length < 118) {
    window.COMPLETE_PERIODIC_TABLE = window.COMPLETE_PERIODIC_TABLE || {};
    if (window.ELEMENTS && window.ELEMENTS.length) {
      window.ELEMENTS.forEach(e => {
        const key = e.number;
        window.COMPLETE_PERIODIC_TABLE[key] = window.COMPLETE_PERIODIC_TABLE[key] || {
          symbol: e.symbol,
          name: e.name,
          category: (e.category || 'unknown').toString().replace(/\s+/g,'-'),
          atomicNumber: e.number,
          atomicMass: e.atomicMass,
          electronConfig: e.electronConfig || '',
          electronegativity: e.electronegativity,
          ionizationEnergy: e.ionizationEnergy || '',
          state: e.state || '',
          discovered: e.discoveredBy || e.discovered || '',
          year: e.year || null,
          description: e.description || '',
          electronShells: (Array.isArray(e.shells) && e.shells.length)
            ? e.shells
            : (typeof generateElectronShells === 'function'
                ? generateElectronShells(e.number)
                : (Array.isArray(e.electronShells) && e.electronShells.length ? e.electronShells : [1])),
          orbitalShells: e.orbitalShells || (typeof generateOrbitalShells === 'function'
            ? generateOrbitalShells(e.number)
            : ''),
          electronVelocity: e.electronVelocity || 2200,
          relativeVelocity: e.relativeVelocity || 0.01
        };
      });
    }
  }
})();