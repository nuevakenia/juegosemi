// Declaración para los CSS que se importan desde TypeScript.
//
// Las hojas de estilo entran por `import` (así el empaquetador las junta en un
// solo `main.css`), pero TypeScript no sabe leer `.css`: esta línea le dice que
// existe cualquier módulo que termine en `.css`.
declare module '*.css';
