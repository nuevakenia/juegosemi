// Declaración para los CSS que se importan desde TypeScript.
//
// La hoja de estilos del paquete ui entra por `import` (así el empaquetador la
// junta en un solo `main.css`), pero TypeScript no sabe leer `.css`: esta línea le
// dice que existe cualquier módulo que termine en `.css`.
declare module '*.css';
