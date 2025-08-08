import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import Drawing from 'dxf-writer';

const __dirname = path.resolve();
const app = express();

app.use(cors());
app.use(express.json());

// 📁 Directorio de documentos DXF
const DOCUMENTS_DIR = path.join(__dirname, 'src/documents');

// 📤 Servir archivos estáticos (para abrirlos desde frontend)
app.use('/documents', express.static(DOCUMENTS_DIR));

// === Función: Validar número ===
function validateNumber(value, defaultValue = 0) {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
}

// === Función: Generar puntos del muro de contención ===
function generarPuntosMuro(anchoPlano, altoPlano, predim, dimen, resultdim) {
    try {
        console.log('📊 Datos recibidos:', { predim, dimen, resultdim });

        // Extraer valores con validación
        const B18 = validateNumber(predim.inputValues.B18, 6.4);
        const B19 = validateNumber(predim.inputValues.B19, 1);
        const D51 = validateNumber(predim.inputValues.D51, 0.1);
        const D47 = validateNumber(predim.inputValues.D47, 10);
        const D49 = validateNumber(predim.inputValues.D49, 8);
        const D45 = validateNumber(predim.inputValues.D45, 0.3);

        console.log('🔢 Valores calculados:', { B18, B19, D51, D47, D49, D45 });

        const H_val = B18 + B19;
        const ZM1 = (D51 * H_val * 2 / 3) - (H_val / D47);

        const ancho = anchoPlano / 2;
        const puntoalto = altoPlano / 2;
        // Calcular dimensiones reales del muro
        const baseTotal = D51 * H_val;
        const alturaZapata = H_val / D49;
        const alturaVastago = H_val;
        const alturaTotal = H_val + alturaZapata;
        const anchoVastago = D45;
        const posicionVastago = (D51 * H_val / 3) + H_val / D47;

        // Generar puntos del muro con coordenadas corregidas
        const points = [
            { x: 0, y: puntoalto, label: 'P1-Base izquierda' },
            { x: baseTotal, y: puntoalto, label: 'P2-Base derecha' },
            { x: baseTotal, y: puntoalto + alturaZapata, label: 'P3-Fin zapata derecha' },
            { x: posicionVastago, y: puntoalto + alturaZapata, label: 'P4-Inicio vástago derecho' },
            { x: posicionVastago, y: puntoalto + H_val, label: 'P5-Corona derecha' },//5
            { x: posicionVastago - anchoVastago, y: puntoalto + H_val, label: 'P6-Corona izquierda' },//6
            { x: (D51 * H_val) / 3, y: puntoalto + alturaZapata, label: 'P7-Inicio vástago izquierdo' },
            { x: 0, y: puntoalto + alturaZapata, label: 'P8-Fin zapata izquierda' },
            { x: 0, y: puntoalto, label: 'P9-Cierre' }
        ];

        // Agregar parámetros calculados para las cotas
        points.params = {
            baseTotal: baseTotal,
            alturaZapata: alturaZapata,
            alturaVastago: H_val,
            alturaTotal: alturaTotal,
            anchoVastago: anchoVastago,
            posicionVastago: posicionVastago,
            talon: (D51 * H_val) / 3,
            puntera: baseTotal - posicionVastago,
            // Puntos críticos para cotas
            minX: 0,
            maxX: baseTotal,
            minY: 6,
            maxY: 6 + alturaTotal
        };

        console.log('✅ Puntos generados:', points.length);
        console.log('📐 Parámetros para cotas:', points.params);
        return points;
    } catch (error) {
        console.error('❌ Error al generar puntos del muro:', error);
        return [];
    }
}

// === Función: Generar puntos para la vista 3D del muro ===
function generarPuntosMuro3D(anchoPlano, altoPlano, predim, dimen, resultdim) {
    try {
        console.log('📊 Datos recibidos:', { predim, dimen, resultdim });

        // Extraer valores con validación
        const B18 = validateNumber(predim.inputValues.B18, 6.4);
        const B19 = validateNumber(predim.inputValues.B19, 1);
        const D51 = validateNumber(predim.inputValues.D51, 0.1);
        const D47 = validateNumber(predim.inputValues.D47, 10);
        const D49 = validateNumber(predim.inputValues.D49, 8);
        const D45 = validateNumber(predim.inputValues.D45, 0.3);

        console.log('🔢 Valores calculados:', { B18, B19, D51, D47, D49, D45 });

        const H_val = B18 + B19;
        const ZM1 = (D51 * H_val * 2 / 3) - (H_val / D47);

        const ancho = anchoPlano / 2;
        const puntoalto = altoPlano / 2;
        // Calcular dimensiones reales del muro
        const baseTotal = D51 * H_val;
        const alturaZapata = H_val / D49;
        const alturaVastago = H_val;
        const alturaTotal = H_val + alturaZapata;
        const anchoVastago = D45;
        const posicionVastago = (D51 * H_val / 3) + H_val / D47;

        // Generar puntos del muro con coordenadas corregidas
        const points = [
            { x: 0, y: puntoalto, label: 'P1-Base izquierda' },
            { x: baseTotal, y: puntoalto, label: 'P2-Base derecha' },
            { x: baseTotal, y: puntoalto + alturaZapata, label: 'P3-Fin zapata derecha' },
            { x: posicionVastago, y: puntoalto + alturaZapata, label: 'P4-Inicio vástago derecho' },
            { x: posicionVastago, y: puntoalto + H_val, label: 'P5-Corona derecha' },//5
            { x: posicionVastago - anchoVastago, y: puntoalto + H_val, label: 'P6-Corona izquierda' },//6
            { x: (D51 * H_val) / 3, y: puntoalto + alturaZapata, label: 'P7-Inicio vástago izquierdo' },
            { x: 0, y: puntoalto + alturaZapata, label: 'P8-Fin zapata izquierda' },
            { x: 0, y: puntoalto, label: 'P9-Cierre' }
        ];

        // Agregar parámetros calculados para las cotas
        points.params = {
            baseTotal: baseTotal,
            alturaZapata: alturaZapata,
            alturaVastago: H_val,
            alturaTotal: alturaTotal,
            anchoVastago: anchoVastago,
            posicionVastago: posicionVastago,
            talon: (D51 * H_val) / 3,
            puntera: baseTotal - posicionVastago,
            // Puntos críticos para cotas
            minX: 0,
            maxX: baseTotal,
            minY: 6,
            maxY: 6 + alturaTotal
        };

        console.log('✅ Puntos generados:', points.length);
        console.log('📐 Parámetros para cotas:', points.params);
        return points;
    } catch (error) {
        console.error('❌ Error al generar puntos del muro:', error);
        return [];
    }
}

// === Función para dibujar polilíneas ===
function drawPolyline(d, puntos) {
    if (!puntos || puntos.length < 2) return;

    for (let i = 0; i < puntos.length - 1; i++) {
        if (puntos[i] && puntos[i + 1]) {
            d.drawLine(puntos[i].x, puntos[i].y, puntos[i + 1].x, puntos[i + 1].y);
        }
    }
}

// === Función para dibujar cota horizontal profesional ===
function drawHorizontalDimension(d, x1, x2, y, offsetY, texto, layer = 'COTAS') {
    const yDim = y + offsetY;
    const longitud = Math.abs(x2 - x1);

    // Asegurar que x1 < x2
    const startX = Math.min(x1, x2);
    const endX = Math.max(x1, x2);

    // Establecer capa
    d.setActiveLayer(layer);

    // Líneas de extensión (más largas para mejor visualización)
    const extensionLength = Math.abs(offsetY) + 0.1;
    d.drawLine(startX, y, startX, y + (offsetY > 0 ? extensionLength : -extensionLength));
    d.drawLine(endX, y, endX, y + (offsetY > 0 ? extensionLength : -extensionLength));

    // Línea de cota principal
    d.drawLine(startX, yDim, endX, yDim);

    // Flechas arquitectónicas (más grandes para mejor visualización)
    const arrowSize = 0.05;
    d.drawLine(startX, yDim, startX + arrowSize, yDim + arrowSize);
    d.drawLine(startX, yDim, startX + arrowSize, yDim - arrowSize);
    d.drawLine(endX, yDim, endX - arrowSize, yDim + arrowSize);
    d.drawLine(endX, yDim, endX - arrowSize, yDim - arrowSize);

    // Texto de cota centrado
    const xText = ((startX + endX) / 2) - 0.1;
    const textHeight = 0.1;
    d.drawText(xText, yDim + (offsetY > 0 ? 0.2 : -0.4), textHeight, 0, texto);

    console.log(`📏 Cota horizontal: ${texto} desde (${startX.toFixed(2)}, ${y}) hasta (${endX.toFixed(2)}, ${y})`);
}

// === Función para dibujar cota vertical profesional ===
function drawVerticalDimension(d, x, y1, y2, offsetX, texto, layer = 'COTAS') {
    const xDim = x + offsetX;

    // Asegurar que y1 < y2
    const startY = Math.min(y1, y2);
    const endY = Math.max(y1, y2);

    // Establecer capa
    d.setActiveLayer(layer);

    // Líneas de extensión
    const extensionLength = Math.abs(offsetX) + 0.1;
    d.drawLine(x, startY, x + (offsetX > 0 ? extensionLength : -extensionLength), startY);
    d.drawLine(x, endY, x + (offsetX > 0 ? extensionLength : -extensionLength), endY);

    // Línea de cota principal
    d.drawLine(xDim, startY, xDim, endY);

    // Flechas
    const arrowSize = 0.05;
    d.drawLine(xDim, startY, xDim + arrowSize, startY + arrowSize);
    d.drawLine(xDim, startY, xDim - arrowSize, startY + arrowSize);
    d.drawLine(xDim, endY, xDim + arrowSize, endY - arrowSize);
    d.drawLine(xDim, endY, xDim - arrowSize, endY - arrowSize);

    // Texto rotado
    const yText = ((startY + endY) / 2) - 0.1;
    const textHeight = 0.1;
    d.drawText(xDim + (offsetX > 0 ? 0.2 : -0.4), yText, textHeight, 90, texto);

    console.log(`📏 Cota vertical: ${texto} desde (${x}, ${startY.toFixed(2)}) hasta (${x}, ${endY.toFixed(2)})`);
}

// === Sistema profesional de cotas basado en puntos reales ===
function agregarCotasProfesionales(d, puntosDesplazados, params, tipoMuro) {
    console.log('🎯 Agregando cotas profesionales para:', tipoMuro);
    console.log('📊 Parámetros recibidos:', params);

    if (!params) {
        console.error('❌ No se recibieron parámetros para las cotas');
        return;
    }

    // Capa específica para cotas
    const layerCotas = `COTAS_${tipoMuro}`;
    d.addLayer(layerCotas, Drawing.ACI.YELLOW, 'CONTINUOUS');
    d.setActiveLayer(layerCotas);

    // Obtener coordenadas extremas de los puntos desplazados
    const minX = Math.min(...puntosDesplazados.map(p => p.x));
    const maxX = Math.max(...puntosDesplazados.map(p => p.x));
    const minY = Math.min(...puntosDesplazados.map(p => p.y));
    const maxY = Math.max(...puntosDesplazados.map(p => p.y));

    // Calcular posiciones clave basadas en los puntos reales
    const baseTotal = maxX - minX;
    const alturaTotal = maxY - minY;
    const alturaZapata = params.alturaZapata;
    const yZapata = minY + alturaZapata;

    // Encontrar las posiciones del vástago en los puntos desplazados
    const vastago = puntosDesplazados.find(p => p.y === maxY); // Punto más alto
    const xVastagoDerechobase = puntosDesplazados[3].x; // P4
    const xVastagoDerecho = puntosDesplazados[4].x; // P5
    const xVastagoIzquierdo = puntosDesplazados[5].x; // P6
    const xVastagoIzquierdo2 = puntosDesplazados[6].x; // P6
    const anchoVastago = xVastagoDerecho - xVastagoIzquierdo;

    console.log('📐 Dimensiones calculadas:', {
        baseTotal: baseTotal.toFixed(2),
        alturaTotal: alturaTotal.toFixed(2),
        alturaZapata: alturaZapata.toFixed(2),
        anchoVastago: anchoVastago.toFixed(2)
    });

    // === COTAS HORIZONTALES INFERIORES ===

    // 1. Cota total de la base (nivel más bajo)
    drawHorizontalDimension(d, minX, maxX, minY, -0.8,
        `${baseTotal.toFixed(2)}m`, layerCotas);

    // 2. Cota del Punta (segmento izquierdo - punta)
    const punta = xVastagoIzquierdo - minX;
    if (punta > 0.1) {
        drawHorizontalDimension(d, minX, xVastagoIzquierdo2, minY, -0.3,
            `${punta.toFixed(2)}m`, layerCotas);
    }

    // 3. Cota del talon (segmento derecho - Talon)
    const talon = maxX - xVastagoDerecho;
    if (talon > 0.1) {
        drawHorizontalDimension(d, xVastagoDerecho, maxX, minY, -0.3,
            `${talon.toFixed(2)}m`, layerCotas);
    }

    // 4. Cota de la base de la pantalla (segmento centrado)
    const basePantalla = xVastagoDerechobase - xVastagoIzquierdo2;
    if (basePantalla > 0.1) {
        drawHorizontalDimension(d, xVastagoIzquierdo2, xVastagoDerechobase, minY, -0.3,
            `${basePantalla.toFixed(2)}m`, layerCotas);
    }

    // 5. Cota del ancho de la corona (ancho de corona)
    drawHorizontalDimension(d, xVastagoIzquierdo, xVastagoDerecho, maxY, 0.3,
        `${anchoVastago.toFixed(2)}m`, layerCotas);

    // === COTAS VERTICALES ===
    // 1. Altura total del muro (lado derecho)
    drawVerticalDimension(d, maxX, minY, maxY, 0.8,
        `${alturaTotal.toFixed(2)}m`, layerCotas);

    // 2. Altura del vástago (desde zapata hasta corona)
    const alturaVastago = maxY - yZapata;
    drawVerticalDimension(d, maxX, yZapata, maxY, 0.3,
        `${alturaVastago.toFixed(2)}m`, layerCotas);

    // 3. Altura de la zapata (lado izquierdo)
    if (alturaZapata > 0.1) {
        // Se dibuja en la misma línea que la altura del vástago para que se vean como componentes de la altura total.
        drawVerticalDimension(d, maxX, minY, yZapata, 0.3,
            `${alturaZapata.toFixed(2)}m`, layerCotas);
    }
}

function agregarCotasProfesionalesDRENAJE(d, puntosDesplazados, sueloDesplazado, params, tipoMuro) {
    console.log('🎯 Agregando cotas profesionales para:', tipoMuro);
    console.log('📊 Parámetros recibidos:', params);

    if (!params) {
        console.error('❌ No se recibieron parámetros para las cotas');
        return;
    }

    // Capa específica para cotas
    const layerCotas = `COTAS_${tipoMuro}`;
    d.addLayer(layerCotas, Drawing.ACI.YELLOW, 'CONTINUOUS');
    d.setActiveLayer(layerCotas);

    // Obtener coordenadas extremas de los puntos desplazados
    const minX = Math.min(...puntosDesplazados.map(p => p.x));
    const maxX = Math.max(...puntosDesplazados.map(p => p.x));
    const minY = Math.min(...puntosDesplazados.map(p => p.y));
    const maxY = Math.max(...puntosDesplazados.map(p => p.y));

    // Calcular posiciones clave basadas en los puntos reales
    const baseTotal = maxX - minX;
    const alturaTotal = maxY - minY;
    const alturaZapata = params.alturaZapata;
    const yZapata = minY + alturaZapata;

    // Encontrar las posiciones del vástago en los puntos desplazados
    const vastago = puntosDesplazados.find(p => p.y === maxY); // Punto más alto
    const xVastagoDerechobase = puntosDesplazados[3].x; // P4
    const xVastagoDerecho = puntosDesplazados[4].x; // P5
    const xVastagoIzquierdo = puntosDesplazados[5].x; // P6
    const xVastagoIzquierdo2 = puntosDesplazados[6].x; // P6
    const anchoVastago = xVastagoDerecho - xVastagoIzquierdo;


    console.log('📐 Dimensiones calculadas:', {
        baseTotal: baseTotal.toFixed(2),
        alturaTotal: alturaTotal.toFixed(2),
        alturaZapata: alturaZapata.toFixed(2),
        anchoVastago: anchoVastago.toFixed(2)
    });

    // === COTAS HORIZONTALES INFERIORES ===

    // 1. Cota total de la base (nivel más bajo)
    drawHorizontalDimension(d, minX, maxX, minY, -0.8,
        `${baseTotal.toFixed(2)}`, layerCotas);

    // 2. Cota del Punta (segmento izquierdo - punta)
    const punta = xVastagoIzquierdo - minX;
    if (punta > 0.1) {
        drawHorizontalDimension(d, minX, xVastagoIzquierdo2, minY, -0.3,
            `${punta.toFixed(2)}`, layerCotas);
    }

    // 3. Cota del talon (segmento derecho - Talon)
    const talon = maxX - xVastagoDerecho;
    if (talon > 0.1) {
        drawHorizontalDimension(d, xVastagoDerecho, maxX, minY, -0.3,
            `${talon.toFixed(2)}`, layerCotas);
    }

    // 4. Cota de la base de la pantalla (segmento centrado)
    const basePantalla = xVastagoDerechobase - xVastagoIzquierdo2;
    if (basePantalla > 0.1) {
        drawHorizontalDimension(d, xVastagoIzquierdo2, xVastagoDerechobase, minY, -0.3,
            `${basePantalla.toFixed(2)}`, layerCotas);
    }

    // === COTAS VERTICALES ===
    // 1. Altura total del muro (lado derecho)
    drawVerticalDimension(d, maxX, minY, maxY, 0.8,
        `${alturaTotal.toFixed(2)}`, layerCotas);

    // 2. Altura de la zapata (lado izquierdo)
    if (alturaZapata > 0.1) {
        // Se dibuja en la misma línea que la altura del vástago para que se vean como componentes de la altura total.
        drawVerticalDimension(d, minX, minY, yZapata, -0.3,
            `${alturaZapata.toFixed(2)}`, layerCotas);
    }

    // // 3. Altura del vástago (desde zapata hasta corona)
    // const alturaVastago = maxY - yZapata;
    // drawVerticalDimension(d, minX, yZapata, maxY, -0.3,
    //     `${alturaVastago.toFixed(2)}m`, layerCotas);

    // 4. Altura desde base hasta línea del suelo (suelo delante)
    const ySuelo = sueloDesplazado[0].y; // Ambos SD1 y SD2 tienen la misma Y
    const alturaSuelo = ySuelo - yZapata;

    if (alturaSuelo > 0.1) {
        drawVerticalDimension(d, minX, yZapata, ySuelo, -0.3,
            `${alturaSuelo.toFixed(2)}`, layerCotas);
    }

    // 5. División del tramo entre suelo y corona en partes de 1 metro
    const alturaSuperior = maxY - ySuelo;
    const paso = 1.0;
    const cantidadDivisiones = Math.floor(alturaSuperior / paso);

    for (let i = 0; i < cantidadDivisiones; i++) {
        const yInicio = ySuelo + i * paso;
        const yFin = ySuelo + (i + 1) * paso;

        drawVerticalDimension(d, minX, yInicio, yFin, -0.3,
            `${paso.toFixed(2)}`, layerCotas);
    }

    // Si sobra un tramo menor a 1m
    const resto = alturaSuperior - cantidadDivisiones * paso;
    if (resto > 0.1) {
        const yInicio = ySuelo + cantidadDivisiones * paso;
        drawVerticalDimension(d, minX, yInicio, maxY, -0.3,
            `${resto.toFixed(2)}`, layerCotas);
    }

}

// === Títulos y rotulación profesional ===
function agregarTituloProfesional(d, x, y = 0, tipoMuro, escala = '1:50', predim) {
    // Capa para títulos
    d.addLayer(`TITULO_${tipoMuro}`, Drawing.ACI.YELLOW, 'CONTINUOUS');
    d.setActiveLayer(`TITULO_${tipoMuro}`);

    // --- LÓGICA DE TÍTULOS MEJORADA ---
    let numero, titulo;
    switch (tipoMuro) {
        case 'REFUERZO':
            numero = '1';
            titulo = 'REFUERZO DE MURO TIPO I_CORTE 1-1';
            break;
        case 'DRENAJE':
            numero = '2';
            titulo = 'DRENAJE DE MURO TIPO I_CORTE 1-1'; // Ajustado para coincidir con la imagen
            break;
        case 'MC3D':
            numero = '3';
            titulo = 'MURO DE CONTENCIÓN VISTA 3D';
            break;
        default:
            numero = '?';
            titulo = 'VISTA DESCONOCIDA';
    }

    // Círculo de referencia
    const radio = 0.4;
    //d.drawCircle(x - 1.0, y + 5.0, radio);
    d.drawCircle(x - 1.0, y + ((16 + predim.inputValues.B18) / 2) + 4.5, radio);

    //d.drawText(x - 1.0, y + 5.0, 0.15, 0, numero);
    d.drawText(x - 1.0, y + ((16 + predim.inputValues.B18) / 2) + 4.5, 0.15, 0, numero);

    //d.drawText(x - 0.4, y + 5.0, 0.12, 0, titulo);
    d.drawText(x - 0.4, y + ((16 + predim.inputValues.B18) / 2) + 4.5, 0.12, 0, titulo);

    // Escala
    //d.drawText(x - 0.4, y + 5.4, 0.1, 0, `ESC. ${escala}`);
    d.drawText(x - 0.4, y + ((16 + predim.inputValues.B18) / 2) + 4.3, 0.1, 0, `ESC. ${escala}`);
}

// === Función principal para dibujar muro completo ===
function dibujarMuroCompleto(d, puntosMuro, offsetX, offsetY, tipoMuro, predim, altoPlano) {
    if (!puntosMuro || puntosMuro.length === 0) {
        console.error(`❌ No hay puntos para dibujar el muro ${tipoMuro}`);
        return [];
    }

    console.log(`🎨 Dibujando muro ${tipoMuro} con ${puntosMuro.length} puntos`);

    // Capa para el muro
    d.addLayer(`MURO_${tipoMuro}`, Drawing.ACI.BLUE, 'CONTINUOUS');
    d.setActiveLayer(`MURO_${tipoMuro}`);

    // Desplazar puntos y preservar las etiquetas
    const puntosDesplazados = puntosMuro.map(p => ({
        x: p.x + offsetX,
        y: p.y + offsetY,
        label: p.label
    }));

    // Dibujar geometría del muro
    drawPolyline(d, puntosDesplazados);

    let sueloDesplazado = null;

    // ✅ Solo para el muro de tipo DRENAJE, agregar suelo delante, ademas agregarmos tubo pb con forma de dos lines con un espaciado de 0.05 color rojo en el muro puntosDesplazados cada 1 metro apartir del sueloDesplazado hacia arriba hasta llegar al punto P[4]
    if (tipoMuro === 'DRENAJE') {
        // Extraer valores con validación
        const B18 = validateNumber(predim.inputValues.B18, 6.4);
        const B19 = validateNumber(predim.inputValues.B19, 1);
        const D51 = validateNumber(predim.inputValues.D51, 0.1);


        const H_val = B18 + B19;
        const puntoalto = altoPlano / 2;
        // Calcular dimensiones reales del muro
        const baseTotal = D51 * H_val;

        // Generar puntos del suelo
        const sueloDelante = [
            { x: baseTotal / 3, y: puntoalto + B19, label: 'SD1' },
            { x: 0, y: puntoalto + B19, label: 'SD2' }
        ];

        // Desplazarlos
        sueloDesplazado = sueloDelante.map(p => ({
            x: p.x + offsetX,
            y: p.y + offsetY,
            label: p.label
        }));

        // Crear capa y dibujar
        d.addLayer(`SUELO_${tipoMuro}`, Drawing.ACI.GREEN, 'DASHED');
        d.setActiveLayer(`SUELO_${tipoMuro}`);
        drawPolyline(d, sueloDesplazado);

        // === TUBOS PB: Dibujar líneas desde cara izquierda hasta cara derecha a 20° ===
        const ySuelo = sueloDesplazado[0].y;
        const yTope = puntosDesplazados[4]?.y;

        if (yTope && yTope > ySuelo + 1) {
            d.addLayer('TUBO_PB', Drawing.ACI.RED, 'CONTINUOUS');
            d.setActiveLayer('TUBO_PB');

            const paso = 1.0;         // Cada metro
            const separacion = 0.05;  // Separación entre las dos líneas del tubo
            const anguloRad = 20 * Math.PI / 180; // 20 grados hacia arriba

            // Puntos del muro inclinado izquierdo
            const pIzqBase = puntosDesplazados[5];  // P[5] - base izquierda
            const pIzqTop = puntosDesplazados[6];   // P[6] - alto izquierda

            // Puntos del muro derecho
            const pDerBase = puntosDesplazados[3];  // P[3] - base derecha  
            const pDerTop = puntosDesplazados[4];   // P[4] - alto derecha

            // Calcular vectores de las caras del muro
            const dxIzq = pIzqTop.x - pIzqBase.x;
            const dyIzq = pIzqTop.y - pIzqBase.y;

            const dxDer = pDerTop.x - pDerBase.x;
            const dyDer = pDerTop.y - pDerBase.y;

            let i = 1;
            while (true) {
                const yInicio = ySuelo + paso * i;
                if (yInicio > yTope) break;

                // Punto de inicio en la cara inclinada izquierda
                const tIzq = (yInicio - pIzqBase.y) / dyIzq;
                if (tIzq < 0 || tIzq > 1) {
                    i++;
                    continue;
                }
                const xInicio = pIzqBase.x + tIzq * dxIzq;

                // Calcular dirección del tubo a 20° hacia arriba
                const cosAngulo = Math.cos(anguloRad);
                const sinAngulo = Math.sin(anguloRad);

                // Encontrar intersección con la cara derecha del muro
                // Ecuación paramétrica del tubo: P = (xInicio, yInicio) + t*(cos20°, sin20°)
                // Ecuación paramétrica cara derecha: Q = pDerBase + s*(dxDer, dyDer)

                let xFin = null, yFin = null;

                // Resolver intersección: xInicio + t*cos20° = pDerBase.x + s*dxDer
                //                       yInicio + t*sin20° = pDerBase.y + s*dyDer

                const denominator = cosAngulo * dyDer - sinAngulo * dxDer;
                if (Math.abs(denominator) > 1e-10) {
                    const numerator = (pDerBase.x - xInicio) * dyDer - (pDerBase.y - yInicio) * dxDer;
                    const t = numerator / denominator;
                    const s = ((xInicio + t * cosAngulo) - pDerBase.x) / dxDer;

                    // Verificar que la intersección está dentro de los límites de la cara derecha
                    if (s >= 0 && s <= 1 && t > 0) {
                        xFin = xInicio + t * cosAngulo;
                        yFin = yInicio + t * sinAngulo;
                    }
                }

                // Si no hay intersección válida con la cara derecha, usar longitud máxima
                if (xFin === null) {
                    // Calcular ancho disponible en esta altura
                    const tDer = (yInicio - pDerBase.y) / dyDer;
                    if (tDer >= 0 && tDer <= 1) {
                        const xDerecho = pDerBase.x + tDer * dxDer;
                        const anchoDisponible = xDerecho - xInicio;
                        const longitudMax = Math.min(anchoDisponible * 0.8, 0.5); // Máximo 50cm o 80% del ancho

                        xFin = xInicio + longitudMax * cosAngulo;
                        yFin = yInicio + longitudMax * sinAngulo;
                    } else {
                        i++;
                        continue;
                    }
                }

                // Dibujar doble línea simulando el tubo PB
                d.drawLine(xInicio, yInicio + separacion / 2, xFin, yFin + separacion / 2);
                d.drawLine(xInicio, yInicio - separacion / 2, xFin, yFin - separacion / 2);

                i++;
            }
        }
    }

    // Solo agregar cotas si NO es la vista 3D
    if (tipoMuro !== 'MC3D') {
        if (puntosMuro.params) {
            if (tipoMuro === "DRENAJE") {
                agregarCotasProfesionalesDRENAJE(d, puntosDesplazados, sueloDesplazado, puntosMuro.params, tipoMuro, predim)
            } else {
                agregarCotasProfesionales(d, puntosDesplazados, puntosMuro.params, tipoMuro, predim);
            }
        } else {
            console.warn(`⚠️ No se encontraron parámetros para el muro ${tipoMuro}`);
        }
    }

    // Agregar título
    agregarTituloProfesional(d, offsetX, offsetY, tipoMuro, '1:50', predim);

    return puntosDesplazados;
}

function dibujarMuroCompleto3D(d, puntosMuro, offsetX, offsetY, tipoMuro, predim, altoPlano) {
    if (!puntosMuro || puntosMuro.length === 0) {
        console.error(`❌ No hay puntos para dibujar el muro ${tipoMuro}`);
        return [];
    }

    console.log(`🎨 Dibujando muro ${tipoMuro} con ${puntosMuro.length} puntos`);

    d.addLayer(`MURO_${tipoMuro}`, Drawing.ACI.WHITE, 'CONTINUOUS');
    d.setActiveLayer(`MURO_${tipoMuro}`);

    // === 1. Desplazar puntos base a la posición final en el plano ===
    const base = puntosMuro.map(p => ({
        x: p.x + offsetX,
        y: p.y + offsetY,
        label: p.label
    }));

    // === 2. Dibujar muro frontal ===
    drawPolyline(d, base);

    // === 3. Calcular puntos proyectados (ángulo 45° en 2D) ===
    const desplazamiento = 2; // magnitud de proyección
    const proy = base.map(p => ({
        x: p.x + desplazamiento,
        y: p.y + desplazamiento,
        label: p.label + '_3D'
    }));

    // === 4. Dibujar líneas entre original y proyectado ===
    for (let i = 0; i < base.length; i++) {
        d.drawLine(base[i].x, base[i].y, proy[i].x, proy[i].y);
    }

    // === 5. (Opcional) unir puntos proyectados en cierto orden ===
    drawPolyline(d, proy);

    // === 6. Mostrar en consola para modificar uno por uno ===
    console.log('📍 Puntos originales:');
    base.forEach((p, i) => console.log(`P${i + 1}: (${p.x}, ${p.y})`));

    console.log('📍 Puntos proyectados 45°:');
    proy.forEach((p, i) => console.log(`P${i + 1}_3D: (${p.x}, ${p.y})`));

    agregarTituloProfesional(d, offsetX, offsetY, tipoMuro, '1:50', predim);

    return { base, proy };
}

// === FUNCIÓN 1: GENERAR CONTORNO INTERNO DEL MURO (FIGURA ROSADA) ===
function generarContornoInternoMuro(puntosMuro, recubrimiento = 0.05) {
    try {
        console.log('🔷 Generando contorno interno del muro...');

        if (!puntosMuro || puntosMuro.length === 0) {
            console.error('❌ No se recibieron puntos del muro');
            return {};
        }

        // Separar los puntos relevantes
        // 👉 Horizontal (rectángulo de base): P1, P2, P3, P8
        // 👉 Vertical (triángulo del vástago): P4, P5, P6 (tal vez P7 para cierre)

        const p = puntosMuro;
        const rectanguloBase = [];
        const trianguloVastago = [];

        // === TRIÁNGULO VERTICAL (cara interior del muro) ===

        const alturaInterior = p[2].y - p[3].y;

        // Punto base superior sobre p[6], subiendo con la altura desde p[2] a p[3]
        trianguloVastago.push({
            x: p[6].x + recubrimiento,
            y: p[1].y + recubrimiento,
            label: `TV1-${p[6].label.split('-')[1]} interno`
        });

        // p[3] ajustado (cara interior vertical)
        trianguloVastago.push({
            x: p[3].x - recubrimiento,
            y: p[1].y + recubrimiento,
            label: `TV2-${p[3].label.split('-')[1]} interno`
        });

        // p[4] ajustado
        trianguloVastago.push({
            x: p[4].x - recubrimiento,
            y: p[4].y - recubrimiento,
            label: `TV3-${p[4].label.split('-')[1]} interno`
        });

        // p[5] ajustado
        trianguloVastago.push({
            x: p[5].x + recubrimiento,
            y: p[5].y - recubrimiento,
            label: `TV4-${p[5].label.split('-')[1]} interno`
        });

        // p[6] ajustado
        trianguloVastago.push({
            x: p[6].x + recubrimiento,
            y: p[6].y - recubrimiento,
            label: `TV5-${p[6].label.split('-')[1]} interno`
        });

        // Cierre (igual que primer punto)
        trianguloVastago.push({
            x: p[6].x + recubrimiento,
            y: p[1].y + recubrimiento,
            label: `TV1-${p[6].label.split('-')[1]} interno`
        });

        // === RECTÁNGULO HORIZONTAL (base/zapata del muro) ===
        rectanguloBase.push({
            x: p[0].x + recubrimiento,
            y: p[0].y + recubrimiento,
            label: `RB1-${p[0].label.split('-')[1]} interno`
        });
        rectanguloBase.push({
            x: p[1].x - recubrimiento,
            y: p[1].y + recubrimiento,
            label: `RB2-${p[1].label.split('-')[1]} interno`
        });
        rectanguloBase.push({
            x: p[2].x - recubrimiento,
            y: p[2].y - recubrimiento,
            label: `RB3-${p[2].label.split('-')[1]} interno`
        });
        rectanguloBase.push({
            x: p[7].x + recubrimiento,
            y: p[7].y - recubrimiento,
            label: `RB4-${p[7].label.split('-')[1]} interno`
        });
        rectanguloBase.push({ // cierre
            x: p[0].x + recubrimiento,
            y: p[0].y + recubrimiento,
            label: 'RB5-Cierre interno'
        });

        // Añadir metadatos
        trianguloVastago.params = {
            tipo: 'CONTORNO_INTERNO_TRIANGULO',
            recubrimiento,
            puntosOriginales: puntosMuro.length,
            puntosInternos: trianguloVastago.length
        };

        rectanguloBase.params = {
            tipo: 'CONTORNO_INTERNO_RECTANGULO',
            recubrimiento,
            puntosOriginales: puntosMuro.length,
            puntosInternos: rectanguloBase.length
        };

        console.log('✅ Contornos internos generados correctamente');
        return {
            trianguloVastago,
            rectanguloBase
        };

    } catch (error) {
        console.error('❌ Error al generar contornos internos:', error);
        return {};
    }
}

// === FUNCIÓN 3: DIBUJAR CONTORNO INTERNO (FIGURA ROSADA) ===
function dibujarContornoInterno(d, contornoInterno, offsetX, offsetY, tipoMuro = 'REFUERZO') {
    console.log(`🔷 Dibujando contorno interno para muro: ${tipoMuro}...`);

    if (!contornoInterno || contornoInterno.length === 0) {
        console.error('❌ No hay contorno interno para dibujar');
        return;
    }

    try {
        // Crear capa para el contorno interno (figura rosada/magenta)
        d.addLayer(`CONTORNO_INTERNO_${tipoMuro}`, Drawing.ACI.MAGENTA, 'CONTINUOUS');
        d.setActiveLayer(`CONTORNO_INTERNO_${tipoMuro}`);

        // Desplazar puntos del contorno interno
        const puntosDesplazados = contornoInterno.map(p => ({
            x: p.x + offsetX,
            y: p.y + offsetY,
            label: p.label
        }));

        // Dibujar la polilínea del contorno interno
        drawPolyline(d, puntosDesplazados);

        console.log(`✅ Contorno interno ${tipoMuro} dibujado con ${puntosDesplazados.length} puntos`);

    } catch (error) {
        console.error(`❌ Error al dibujar contorno interno ${tipoMuro}:`, error);
    }
}

// === FUNCIÓN 4: DIBUJAR ACEROS INTERNOS (LÍNEAS Y PUNTOS) ===
function generarAcerosInternosMuro(contornos, espaciadoGeneral = 0.20) {
    console.log('🔩 Generando aceros en el perímetro del contorno...');

    if (!contornos || !contornos.trianguloVastago || !contornos.rectanguloBase) {
        console.error('❌ No se recibieron contornos válidos para generar aceros');
        return { rectangulo: [], triangulo: [] };
    }

    const aceros = {
        rectangulo: [],
        triangulo: []
    };

    const { trianguloVastago, rectanguloBase } = contornos;

    // === ACEROS SOLO EN BORDES SUPERIOR E INFERIOR DEL RECTÁNGULO ===
    const rectanguloPerimetro = rectanguloBase.slice(0, -1); // Quitar el punto de cierre

    // Lado superior del rectángulo: Acero 3/8" @ 17cm
    const espaciadoSuperior = 0.17;
    const ladoSuperior = calcularAcerosEnLinea(
        rectanguloPerimetro[2], // punto superior izquierdo
        rectanguloPerimetro[3], // punto superior derecho
        espaciadoSuperior,
        "3/8",
        "rectangulo_superior"
    );
    aceros.rectangulo.push(...ladoSuperior);

    // Lado inferior del rectángulo: Acero 1/2" @ 20cm
    const espaciadoInferior = 0.20;
    const ladoInferior = calcularAcerosEnLinea(
        rectanguloPerimetro[0], // punto inferior izquierdo
        rectanguloPerimetro[1], // punto inferior derecho
        espaciadoInferior,
        "1/2",
        "rectangulo_inferior"
    );
    aceros.rectangulo.push(...ladoInferior);

    // === ACEROS SOLO EN LADOS IZQUIERDO Y DERECHO DEL TRIÁNGULO ===
    const trianguloPerimetro = trianguloVastago.slice(0, -1); // Quitar el punto de cierre

    // Lado izquierdo del triángulo: del punto 0 al punto 2
    const ladoIzquierdo = calcularAcerosEnLinea(
        trianguloPerimetro[0],
        trianguloPerimetro[3],
        0.20,
        "1/2",
        "triangulo_izquierdo"
    );
    aceros.triangulo.push(...ladoIzquierdo);

    // Lado derecho del triángulo: del punto 2 al punto 1
    const ladoDerecho = calcularAcerosEnLinea(
        trianguloPerimetro[2],
        trianguloPerimetro[1],
        0.20,
        "3/8",
        "triangulo_derecho"
    );
    aceros.triangulo.push(...ladoDerecho);

    console.log(`✅ Aceros en bordes específicos - Rectángulo: ${aceros.rectangulo.length}, Triángulo: ${aceros.triangulo.length}`);

    return aceros;
}

// === FUNCIÓN AUXILIAR: CALCULAR ACEROS A LO LARGO DE UNA LÍNEA ===
function calcularAcerosEnLinea(puntoInicio, puntoFin, espaciado, diametro, zona) {
    const aceros = [];

    // Vector de dirección
    const dx = puntoFin.x - puntoInicio.x;
    const dy = puntoFin.y - puntoInicio.y;
    const longitud = Math.sqrt(dx * dx + dy * dy);

    if (longitud === 0) return [];

    const ux = dx / longitud; // unitario en x
    const uy = dy / longitud; // unitario en y

    // Desplazamiento de 0.1 en dirección de la línea
    const desplazamiento = 0.1;

    const nuevoInicio = {
        x: puntoInicio.x + desplazamiento * ux,
        y: puntoInicio.y + desplazamiento * uy
    };

    const nuevoFin = {
        x: puntoFin.x - desplazamiento * ux,
        y: puntoFin.y - desplazamiento * uy
    };

    const dxNuevo = nuevoFin.x - nuevoInicio.x;
    const dyNuevo = nuevoFin.y - nuevoInicio.y;
    const longitudUtil = Math.sqrt(dxNuevo * dxNuevo + dyNuevo * dyNuevo);

    const numeroAceros = Math.floor(longitudUtil / espaciado) + 1;

    for (let i = 0; i < numeroAceros; i++) {
        const t = i / Math.max(1, numeroAceros - 1);
        const x = nuevoInicio.x + t * dxNuevo;
        const y = nuevoInicio.y + t * dyNuevo;

        aceros.push({
            x: x,
            y: y,
            diametro: diametro,
            zona: zona,
            etiqueta: `${zona}_${i + 1}`
        });
    }

    return aceros;
}

// === 1. RESTAURAR FUNCIÓN dibujarAcerosInternos ORIGINAL (MOSTRAR TODOS LOS ACEROS) ===
function dibujarAcerosInternos(d, aceros, offsetX = 0, offsetY = 0, layer = 'ACERO') {
    console.log('🔩 Dibujando aceros como puntos amarillos en bordes específicos...');

    // Crear capa para aceros
    d.addLayer(`${layer}_PUNTOS`, Drawing.ACI.YELLOW, 'CONTINUOUS');
    d.setActiveLayer(`${layer}_PUNTOS`);

    const grupos = ['rectangulo', 'triangulo'];
    let totalAceros = 0;

    grupos.forEach(grupo => {
        if (!aceros[grupo] || aceros[grupo].length === 0) {
            console.warn(`⚠️ No hay aceros en el grupo: ${grupo}`);
            return;
        }

        console.log(`🔩 Dibujando ${aceros[grupo].length} puntos de acero en ${grupo}`);

        aceros[grupo].forEach((acero, index) => {
            // Determinar el radio del punto según el diámetro del acero
            let radioPunto;
            switch (acero.diametro) {
                case "3/8":
                    radioPunto = 0.01;
                    break;
                case "1/2":
                    radioPunto = 0.01;
                    break;
                default:
                    radioPunto = 0.02;
            }

            // Desplazamiento condicional según zona
            let deltaX = 0;
            let deltaY = 0;

            switch (acero.zona) {
                case "rectangulo_superior":
                    deltaY = -0.05;
                    break;
                case "rectangulo_inferior":
                    deltaY = +0.04;
                    break;
                case "triangulo_izquierdo":
                    deltaX = +0.05;
                    break;
                case "triangulo_derecho":
                    deltaX = -0.05;
                    break;
            }

            // Dibujar el punto (círculo relleno)
            d.drawCircle(
                acero.x + offsetX + deltaX,
                acero.y + offsetY + deltaY,
                radioPunto
            );

            totalAceros++;
        });
    });

    console.log(`✅ Total de puntos de acero mostrados: ${totalAceros}`);
}

// === 2. NUEVA FUNCIÓN: DIBUJAR LEADERS (MLEADER) PARA ACEROS ===
function drawLeader(d, startX, startY, endX, endY, texto, layer = 'LEADERS') {
    // Establecer capa
    d.setActiveLayer(layer);

    // Línea principal del leader
    d.drawLine(startX, startY, endX, endY);

    // Flecha al final (punto de acero)
    const arrowSize = 0.05;
    const angle = Math.atan2(startY - endY, startX - endX);

    // Dibujar flecha
    d.drawLine(startX, startY,
        startX - arrowSize * Math.cos(angle - 0.3),
        startY - arrowSize * Math.sin(angle - 0.3));
    d.drawLine(startX, startY,
        startX - arrowSize * Math.cos(angle + 0.3),
        startY - arrowSize * Math.sin(angle + 0.3));

    // Línea horizontal corta para el texto
    const lineLength = 0.3;
    const textStartX = endX;
    const textEndX = endX + lineLength;
    d.drawLine(textStartX, endY, textEndX, endY);

    // Texto del leader
    const textHeight = 0.08;
    d.drawText(textEndX + 0.05, endY + 0.02, textHeight, 0, texto);

    console.log(`📝 Leader dibujado: ${texto} desde (${startX.toFixed(2)}, ${startY.toFixed(2)})`);
}

// === 3. FUNCIÓN PARA AGREGAR COTAS LEADER A LOS ACEROS ===
function agregarCotasLeaderAceros(d, aceros, offsetX = 0, offsetY = 0) {
    console.log('📝 Agregando cotas leader para aceros...');

    // Crear capa para leaders
    d.addLayer('ACERO_LEADERS', Drawing.ACI.WHITE, 'CONTINUOUS');
    d.setActiveLayer('ACERO_LEADERS');

    const grupos = ['rectangulo', 'triangulo'];

    grupos.forEach(grupo => {
        if (!aceros[grupo] || aceros[grupo].length === 0) {
            console.warn(`⚠️ No hay aceros en el grupo: ${grupo}`);
            return;
        }

        // Agrupar aceros por zona
        const acerosAgrupadosPorZona = {};
        aceros[grupo].forEach(acero => {
            if (!acerosAgrupadosPorZona[acero.zona]) {
                acerosAgrupadosPorZona[acero.zona] = [];
            }
            acerosAgrupadosPorZona[acero.zona].push(acero);
        });

        // Crear un leader para cada zona (apuntando al primer acero de cada zona)
        Object.keys(acerosAgrupadosPorZona).forEach(zona => {
            const acerosZona = acerosAgrupadosPorZona[zona];
            const primerAcero = acerosZona[0];

            if (primerAcero) {
                // Calcular espaciado entre aceros
                let espaciado = 0;
                if (acerosZona.length > 1) {
                    const dx = acerosZona[1].x - acerosZona[0].x;
                    const dy = acerosZona[1].y - acerosZona[0].y;
                    espaciado = Math.sqrt(dx * dx + dy * dy);
                }

                // Determinar texto según zona
                let textoLeader = '';
                let espaciadoCm = Math.round(espaciado * 100);

                switch (zona) {
                    case "rectangulo_superior":
                        textoLeader = `1∅3/8"@${espaciadoCm || 17}cm`;
                        break;
                    case "rectangulo_inferior":
                        textoLeader = `1∅1/2"@${espaciadoCm || 20}cm`;
                        break;
                    case "triangulo_izquierdo":
                        textoLeader = `1∅1/2"@${espaciadoCm || 20}cm`;
                        break;
                    case "triangulo_derecho":
                        textoLeader = `1∅3/8"@${espaciadoCm || 20}cm`;
                        break;
                }

                // Aplicar desplazamientos según zona
                let deltaX = 0;
                let deltaY = 0;
                let leaderEndX, leaderEndY;

                switch (zona) {
                    case "rectangulo_superior":
                        deltaY = -0.05;
                        leaderEndX = primerAcero.x + offsetX - 1.5;
                        leaderEndY = primerAcero.y + offsetY + deltaY + 0.5;
                        break;
                    case "rectangulo_inferior":
                        deltaY = +0.04;
                        leaderEndX = primerAcero.x + offsetX - 2;
                        leaderEndY = primerAcero.y + offsetY + deltaY + 0.5;
                        break;
                    case "triangulo_izquierdo":
                        deltaX = +0.05;
                        leaderEndX = primerAcero.x + offsetX + deltaX - 1.0;
                        leaderEndY = primerAcero.y + offsetY + 3;
                        break;
                    case "triangulo_derecho":
                        deltaX = -0.05;
                        leaderEndX = primerAcero.x + offsetX + deltaX + 1.0;
                        leaderEndY = primerAcero.y + offsetY + 0.3;
                        break;
                }

                // Dibujar el leader
                drawLeader(d,
                    primerAcero.x + offsetX + deltaX,  // punto del acero
                    primerAcero.y + offsetY + deltaY,
                    leaderEndX,  // punto final del leader
                    leaderEndY,
                    textoLeader,
                    'ACERO_LEADERS');
            }
        });
    });

    console.log('✅ Cotas leader para aceros agregadas correctamente');
}
// === FUNCIÓN PARA AGREGAR MLEADERS A LA ESTRUCTURA INTERNA ===
function agregarMLeadersEstructuraInterna(d, contornos, offsetX = 0, offsetY = 0) {
    console.log('📝 Agregando MLeaders para estructura interna...');

    // Crear capa para leaders de estructura
    d.addLayer('ESTRUCTURA_LEADERS', Drawing.ACI.CYAN, 'CONTINUOUS');
    d.setActiveLayer('ESTRUCTURA_LEADERS');

    const { trianguloVastago, rectanguloBase } = contornos;

    // Aplicar offsets a los puntos
    const rectPoints = rectanguloBase.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }));
    const triPoints = trianguloVastago.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }));

    // ===== 1. MLEADER PARA ANCHO SUPERIOR DEL RECTÁNGULO =====
    const anchoSuperior = Math.abs(rectPoints[2].x - rectPoints[3].x);
    const puntoMedioSuperior = {
        x: (rectPoints[2].x + rectPoints[3].x) / 2,
        y: rectPoints[2].y
    };

    // Leader para ancho superior (arriba de la estructura)
    const leaderSupX = puntoMedioSuperior.x + 0.5;
    const leaderSupY = puntoMedioSuperior.y + 0.6;

    drawMultiLeaderWithExtension(d,
        puntoMedioSuperior.x, puntoMedioSuperior.y,
        leaderSupX, leaderSupY,
        `${1}@3/8"${anchoSuperior.toFixed(2)}cm`,
        'ESTRUCTURA_LEADERS',
        'top'
    );

    // ===== 2. MLEADER PARA ANCHO INFERIOR DEL RECTÁNGULO =====
    const anchoInferior = Math.abs(rectPoints[1].x - rectPoints[0].x);
    const puntoMedioInferior = {
        x: (rectPoints[0].x + rectPoints[1].x) / 2,
        y: rectPoints[0].y
    };

    // Leader para ancho inferior (abajo de la estructura)
    const leaderInfX = puntoMedioInferior.x - 3;
    const leaderInfY = puntoMedioInferior.y + 1;

    drawMultiLeaderWithExtension(d,
        puntoMedioInferior.x, puntoMedioInferior.y,
        leaderInfX, leaderInfY,
        `${1}@3/8"${anchoInferior.toFixed(2)}cm`,
        'ESTRUCTURA_LEADERS',
        'bottom'
    );

    // ===== 3. MLEADER PARA ALTURA IZQUIERDA DEL TRIÁNGULO =====
    const alturaIzquierda = Math.abs(triPoints[3].y - triPoints[0].y);
    const puntoMedioIzquierdo = {
        x: (triPoints[0].x + triPoints[3].x) / 2,
        y: (triPoints[0].y + triPoints[3].y) / 2
    };

    // Leader para altura izquierda
    const leaderIzqX = puntoMedioIzquierdo.x - 1.2;
    const leaderIzqY = puntoMedioIzquierdo.y;

    drawMultiLeaderWithExtension(d,
        puntoMedioIzquierdo.x, puntoMedioIzquierdo.y,
        leaderIzqX, leaderIzqY,
        `${1}@3/8"${alturaIzquierda.toFixed(2)}cm`,
        'ESTRUCTURA_LEADERS',
        'left'
    );

    // ===== 4. MLEADER PARA ALTURA DERECHA DEL TRIÁNGULO =====
    const alturaDerecha = Math.abs(triPoints[2].y - triPoints[1].y);
    const puntoMedioDerecho = {
        x: (triPoints[1].x + triPoints[2].x) / 2,
        y: (triPoints[1].y + triPoints[2].y) / 2
    };

    // Leader para altura derecha
    const leaderDerX = puntoMedioDerecho.x + 1.2;
    const leaderDerY = puntoMedioDerecho.y;

    drawMultiLeaderWithExtension(d,
        puntoMedioDerecho.x, puntoMedioDerecho.y,
        leaderDerX, leaderDerY,
        `${1}@3/8"${alturaDerecha.toFixed(2)}cm`,
        'ESTRUCTURA_LEADERS',
        'right'
    );

    // // ===== 5. MLEADERS PARA ESQUINAS DEL RECTÁNGULO =====

    // // Esquina inferior izquierda
    // const leaderEsqIzqInfX = rectPoints[0].x - 0.8;
    // const leaderEsqIzqInfY = rectPoints[0].y - 0.5;

    // drawMultiLeaderWithExtension(d,
    //     rectPoints[0].x, rectPoints[0].y,
    //     leaderEsqIzqInfX, leaderEsqIzqInfY,
    //     `${(Math.abs(rectPoints[0].x) * 100).toFixed(0)}@${Math.abs(rectPoints[0].x).toFixed(2)}cm`,
    //     'ESTRUCTURA_LEADERS',
    //     'corner'
    // );

    // // Esquina inferior derecha
    // const leaderEsqDerInfX = rectPoints[1].x + 0.8;
    // const leaderEsqDerInfY = rectPoints[1].y - 0.5;

    // drawMultiLeaderWithExtension(d,
    //     rectPoints[1].x, rectPoints[1].y,
    //     leaderEsqDerInfX, leaderEsqDerInfY,
    //     `${(Math.abs(rectPoints[1].x) * 100).toFixed(0)}@${Math.abs(rectPoints[1].x).toFixed(2)}cm`,
    //     'ESTRUCTURA_LEADERS',
    //     'corner'
    // );

    // ===== 6. SÍMBOLO DE SOLDADURA =====

    // Agregar símbolo y texto de soldado en la base
    const simboloSoldX = puntoMedioInferior.x + 1.5;
    const simboloSoldY = puntoMedioInferior.y - 0.3;

    // Dibujar símbolo de soldadura (zigzag)
    dibujarSimboloSoldadura(d, simboloSoldX, simboloSoldY);

    // Texto "Soldado"
    d.drawText(simboloSoldX + 0.3, simboloSoldY, 0.15, 0, 'Soldado', 'ESTRUCTURA_LEADERS');

    console.log('✅ MLeaders para estructura interna agregados correctamente');
}

function drawMultiLeaderWithExtension(d, startX, startY, endX, endY, text, layer, direction) {
    // Calcular puntos de extensión según la dirección
    let extensionStartX = startX;
    let extensionStartY = startY;
    let extensionEndX = endX;
    let extensionEndY = endY;

    switch (direction) {
        case 'top':
            extensionStartY = startY + 0.1;
            extensionEndY = endY - 0.1;
            break;
        case 'bottom':
            extensionStartY = startY - 0.1;
            extensionEndY = endY + 0.1;
            break;
        case 'left':
            extensionStartX = startX - 0.1;
            extensionEndX = endX + 0.1;
            break;
        case 'right':
            extensionStartX = startX + 0.1;
            extensionEndX = endX - 0.1;
            break;
        case 'corner':
            // Para esquinas, línea directa
            break;
    }

    // Dibujar línea de extensión desde el punto de la estructura
    d.drawLine(startX, startY, extensionStartX, extensionStartY, layer);

    // Dibujar línea principal del leader
    d.drawLine(extensionStartX, extensionStartY, extensionEndX, extensionEndY, layer);

    // Dibujar flecha al final
    dibujarFlecha(d, extensionEndX, extensionEndY, extensionStartX, extensionStartY, 0.05, layer);

    // Agregar texto
    const textX = endX + (direction === 'right' ? 0.1 : direction === 'left' ? -0.5 : 0);
    const textY = endY + 0.05;

    d.drawText(textX, textY, 0.12, 0, text, layer);
}

function dibujarFlecha(d, tipX, tipY, baseX, baseY, size, layer) {
    // Calcular ángulo de la línea
    const angle = Math.atan2(tipY - baseY, tipX - baseX);

    // Calcular puntos de la flecha
    const arrowAngle = Math.PI / 6; // 30 grados
    const x1 = tipX - size * Math.cos(angle - arrowAngle);
    const y1 = tipY - size * Math.sin(angle - arrowAngle);
    const x2 = tipX - size * Math.cos(angle + arrowAngle);
    const y2 = tipY - size * Math.sin(angle + arrowAngle);

    // Dibujar las dos líneas de la flecha
    d.drawLine(tipX, tipY, x1, y1, layer);
    d.drawLine(tipX, tipY, x2, y2, layer);
}

function dibujarSimboloSoldadura(d, x, y) {
    const size = 0.1;
    const points = [];

    // Crear patrón zigzag para símbolo de soldadura
    for (let i = 0; i < 5; i++) {
        const offsetX = i * (size / 2);
        const offsetY = (i % 2 === 0) ? 0 : size / 2;
        points.push({ x: x + offsetX, y: y + offsetY });
    }

    // Dibujar líneas conectando los puntos
    for (let i = 0; i < points.length - 1; i++) {
        d.drawLine(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, 'ESTRUCTURA_LEADERS');
    }
}

// === FUNCIONALIDAD ESPECÍFICA PARA CARA 4: ACERO EN CARA INTERIOR_EJE A-A ===
const CONFIGURACION_ACERO = {
    INTERIOR: { diametro: '3/8', cantidad: 1, color: 'GREEN' },
    EXTERIOR: { diametro: '3/8', cantidad: 1, color: 'GREEN' },
    INFERIOR: { diametro: '1/2', cantidad: 1, color: 'CYAN' },
    SUPERIOR: { diametro: '1/2', cantidad: 1, color: 'CYAN' }
};

// === GENERADOR DE MALLA MEJORADO ===
function generarMallaAceroInterior(anchoPlano, altoPlano, predim, dimen, resultdim, tipoCara = 'INTERIOR') {

    const B18 = validateNumber(predim.inputValues.B18, 6.4);
    const B19 = validateNumber(predim.inputValues.B19, 1);
    const D51 = validateNumber(predim.inputValues.D51, 0.1);
    const D49 = validateNumber(predim.inputValues.D49, 8);

    const H_val = B18 + B19;
    const alturaZapata = H_val / D49;
    const baseTotal = D51 * H_val;

    const CONFIGURACION_CARAS = {
        INTERIOR: {
            ancho: 4.0,
            alto: H_val - alturaZapata,
            espaciado: 0.2,
            orientacion: 'vertical',
            descripcion: 'ACERO EN CARA INTERIOR_EJE A-A'
        },
        EXTERIOR: {
            ancho: 4.0,
            alto: H_val - alturaZapata,
            espaciado: 0.2,
            orientacion: 'vertical',
            descripcion: 'ACERO EN CARA EXTERIOR_EJE A-A'
        },
        INFERIOR: {
            ancho: 4.0, // Base del muro
            alto: baseTotal,   // Altura reducida para zapata
            espaciado: 0.2,
            //orientacion: 'horizontal',
            orientacion: 'vertical',
            descripcion: 'REFUERZO INFERIOR DE ZAPATA'
        },
        SUPERIOR: {
            ancho: 4.0, // Base del muro
            alto: baseTotal,   // Altura reducida para zapata
            espaciado: 0.2,
            orientacion: 'vertical',
            descripcion: 'REFUERZO SUPERIOR DE ZAPATA'
        }
    };

    try {
        console.log(`🔩 Generando malla ${tipoCara}...`);

        // Obtener configuración específica para el tipo de cara
        const config = CONFIGURACION_CARAS[tipoCara];
        if (!config) {
            console.error(`❌ Configuración no encontrada para tipo: ${tipoCara}`);
            return [];
        }

        // Dimensiones específicas según el tipo de cara
        const anchoMalla = config.ancho;
        const altoMalla = config.alto;
        const espaciadoGrid = config.espaciado;

        // Posición inicial adaptativa
        const xInicioMalla = 1;
        const yInicioMalla = (tipoCara === 'INTERIOR' || tipoCara === 'EXTERIOR' || tipoCara === 'INFERIOR' || tipoCara === 'SUPERIOR') ? 2 : 4;
        const xFinMalla = xInicioMalla + anchoMalla;
        const yFinMalla = yInicioMalla + altoMalla;

        console.log(`📐 Configuración ${tipoCara}:`, {
            ancho: anchoMalla,
            alto: altoMalla,
            espaciado: espaciadoGrid,
            orientacion: config.orientacion
        });

        const lineasMalla = [];

        // === LÍNEAS VERTICALES DE LA CUADRÍCULA ===
        const numeroLineasVerticales = Math.floor(anchoMalla / espaciadoGrid) + 1;
        for (let i = 0; i <= numeroLineasVerticales; i++) {
            const xLinea = xInicioMalla + (i * espaciadoGrid);
            if (xLinea <= xFinMalla) {
                lineasMalla.push({
                    x1: xLinea, y1: yInicioMalla, x2: xLinea, y2: yFinMalla,
                    tipo: 'linea_vertical', color: 'verde', label: `LV${i + 1}`
                });
            }
        }

        // === LÍNEAS HORIZONTALES DE LA CUADRÍCULA ===
        const numeroLineasHorizontales = Math.floor(altoMalla / espaciadoGrid) + 1;
        for (let i = 0; i <= numeroLineasHorizontales; i++) {
            const yLinea = yInicioMalla + (i * espaciadoGrid);
            if (yLinea <= yFinMalla) {
                lineasMalla.push({
                    x1: xInicioMalla, y1: yLinea, x2: xFinMalla, y2: yLinea,
                    tipo: 'linea_horizontal', color: 'magenta', label: `LH${i + 1}`
                });
            }
        }

        // === MARCO EXTERIOR ===
        const marcoExterior = [
            { x1: xInicioMalla, y1: yInicioMalla, x2: xFinMalla, y2: yInicioMalla, tipo: 'marco', color: 'blanco' },
            { x1: xFinMalla, y1: yInicioMalla, x2: xFinMalla, y2: yFinMalla, tipo: 'marco', color: 'blanco' },
            { x1: xFinMalla, y1: yFinMalla, x2: xInicioMalla, y2: yFinMalla, tipo: 'marco', color: 'blanco' },
            { x1: xInicioMalla, y1: yFinMalla, x2: xInicioMalla, y2: yInicioMalla, tipo: 'marco', color: 'blanco' }
        ];

        const todasLasLineas = [...lineasMalla, ...marcoExterior];

        // Parámetros técnicos mejorados
        todasLasLineas.params = {
            tipoCara: tipoCara,
            tipoRefuerzo: 'MALLA_CUADRICULADA',
            configuracion: config,
            acero: CONFIGURACION_ACERO[tipoCara],
            anchoTotal: anchoMalla,
            altoTotal: altoMalla,
            espaciadoGrid: espaciadoGrid,
            numeroLineasVerticales: numeroLineasVerticales + 1,
            numeroLineasHorizontales: numeroLineasHorizontales + 1,
            xMin: xInicioMalla, xMax: xFinMalla,
            yMin: yInicioMalla, yMax: yFinMalla
        };

        console.log(`✅ Malla ${tipoCara} generada con ${todasLasLineas.length} líneas`);
        return todasLasLineas;

    } catch (error) {
        console.error(`❌ Error generando malla ${tipoCara}:`, error);
        return [];
    }
}

// === DIBUJADO DE MALLA MEJORADO ===
function dibujarMallaAceroInterior(d, lineasMalla, offsetX, offsetY, tipoCara = 'INTERIOR') {
    console.log(`🔩 Dibujando malla ${tipoCara}...`);

    if (!lineasMalla || lineasMalla.length === 0) {
        console.error('❌ No hay líneas de malla para dibujar');
        return;
    }

    try {
        // Obtener configuración de colores
        const configAcero = CONFIGURACION_ACERO[tipoCara];
        const colorPrincipal = Drawing.ACI[configAcero.color] || Drawing.ACI.GREEN;

        // Crear capas específicas
        d.addLayer(`MALLA_VERT_${tipoCara}`, colorPrincipal, 'CONTINUOUS');
        d.addLayer(`MALLA_HORIZ_${tipoCara}`, Drawing.ACI.MAGENTA, 'CONTINUOUS');
        d.addLayer(`MARCO_${tipoCara}`, Drawing.ACI.WHITE, 'CONTINUOUS');

        // Dibujar líneas
        lineasMalla.forEach((linea) => {
            const x1 = linea.x1 + offsetX;
            const y1 = linea.y1 + offsetY;
            const x2 = linea.x2 + offsetX;
            const y2 = linea.y2 + offsetY;

            if (linea.tipo === 'linea_vertical') {
                d.setActiveLayer(`MALLA_VERT_${tipoCara}`);
                d.drawLine(x1, y1, x2, y2);
            } else if (linea.tipo === 'linea_horizontal') {
                d.setActiveLayer(`MALLA_HORIZ_${tipoCara}`);
                d.drawLine(x1, y1, x2, y2);
            } else if (linea.tipo === 'marco') {
                d.setActiveLayer(`MARCO_${tipoCara}`);
                d.drawLine(x1, y1, x2, y2);
            }
        });

        // Agregar cotas con MLeader y información técnica
        if (lineasMalla.params) {
            agregarCotasConMLeader(d, offsetX, offsetY, lineasMalla.params, tipoCara);
            agregarInfoTecnicaMalla(d, offsetX, offsetY, lineasMalla.params, tipoCara);
        }

        console.log(`✅ Malla ${tipoCara} dibujada correctamente`);

    } catch (error) {
        console.error(`❌ Error dibujando malla ${tipoCara}:`, error);
    }
}

// === COTAS CON MLEADER ===
function agregarCotasConMLeader(d, offsetX, offsetY, params, tipoCara) {
    const layerCotas = `COTAS_${tipoCara}`;
    d.addLayer(layerCotas, Drawing.ACI.WHITE, 'CONTINUOUS');
    d.setActiveLayer(layerCotas);

    const config = params.configuracion;
    const configAcero = params.acero;

    const xMin = params.xMin + offsetX;
    const xMax = params.xMax + offsetX;
    const yMin = params.yMin + offsetY;
    const yMax = params.yMax + offsetY;

    // Texto de especificación del acero
    const espaciadoCm = params.espaciadoGrid * 100;
    const textoAcero = `${configAcero.cantidad}∅${configAcero.diametro}"@${espaciadoCm.toFixed(0)}cm`;

    // MLeader para dimensión horizontal total
    try {
        const puntosHoriz = [
            { x: xMin, y: yMin - 0.15 },
            { x: (xMin + xMax) / 2, y: yMin - 0.4 }
        ];
        d.drawMLeader(puntosHoriz, `${params.anchoTotal.toFixed(2)}m`);
    } catch (e) {
        // Fallback a línea de cota tradicional
        drawHorizontalDimension(d, xMin, xMax, yMin, -0.1, `${params.anchoTotal.toFixed(2)}m`, layerCotas);
    }

    // MLeader para dimensión vertical total
    try {
        const puntosVert = [
            { x: xMax + 0.15, y: yMin },
            { x: xMax + 0.4, y: (yMin + yMax) / 2 }
        ];
        d.drawMLeader(puntosVert, `${params.altoTotal.toFixed(2)}m`);
    } catch (e) {
        // Fallback a línea de cota tradicional
        drawVerticalDimension(d, xMax, yMin, yMax, 0.1, `${params.altoTotal.toFixed(2)}m`, layerCotas);
    }

    // MLeader para espaciado del acero
    try {
        const puntosEspaciado = [
            { x: xMin, y: yMax + 0.15 },
            { x: xMin + 0.5, y: yMax + 0.4 }
        ];
        d.drawMLeader(puntosEspaciado, textoAcero);
    } catch (e) {
        // Fallback a línea de cota tradicional
        drawHorizontalDimension(d, xMin, xMin + params.espaciadoGrid, yMax, 0.3, textoAcero, layerCotas);
    }
}

// === INFORMACIÓN TÉCNICA MEJORADA ===
function agregarInfoTecnicaMalla(d, offsetX, offsetY, params, tipoCara) {
    const layerInfo = `INFO_${tipoCara}`;
    d.addLayer(layerInfo, Drawing.ACI.YELLOW, 'CONTINUOUS');
    d.setActiveLayer(layerInfo);

    const config = params.configuracion;
    const tituloY = offsetY + (tipoCara === 'INTERIOR' || tipoCara === 'EXTERIOR' || tipoCara === 'INFERIOR' || tipoCara === 'SUPERIOR' ? 1.0 : 1.0);

    // Título principal
    d.drawText(offsetX, tituloY, 0.15, 0, config.descripcion);

    // Escala
    d.drawText(offsetX, tituloY - 0.3, 0.10, 0, 'ESC. 1:50');

    // Círculo de referencia con número
    const radioCirculo = 0.3;
    const xCirculo = offsetX - 0.5;
    const yCirculo = tituloY;

    d.drawCircle(xCirculo, yCirculo, radioCirculo);

    // Número de referencia según el tipo
    const numeroRef = { 'INTERIOR': '4', 'EXTERIOR': '5', 'INFERIOR': '6', 'SUPERIOR': '7' };
    d.drawText(xCirculo, yCirculo, 0.12, 0, numeroRef[tipoCara] || '4');
}

// === FUNCIÓN PRINCIPAL DE GENERACIÓN Y DIBUJADO CON OFFSETS PERSONALIZADOS ===
function generarYDibujarTodasLasCaras(d, anchoPlano, altoPlano, predim, dimen, resultdim, offsetsConfig) {
    console.log('🏗️ Generando todas las caras de malla de acero...');

    // Configuración de offsets específicos (manteniendo el orden original)
    const configuracionOffsets = offsetsConfig || {
        INTERIOR: { x: 0, y: 2 },
        EXTERIOR: { x: 10, y: 2 },
        INFERIOR: { x: 20, y: 2 },
        SUPERIOR: { x: 30, y: 2 }
    };

    const tiposCaras = ['INTERIOR', 'EXTERIOR', 'INFERIOR', 'SUPERIOR'];

    tiposCaras.forEach((tipoCara) => {
        console.log(`\n--- Procesando cara ${tipoCara} ---`);

        // Obtener offset específico para esta cara
        const offset = configuracionOffsets[tipoCara];

        if (!offset) {
            console.error(`❌ No se encontró configuración de offset para ${tipoCara}`);
            return;
        }

        // Generar malla específica para este tipo de cara
        const puntosMalla = generarMallaAceroInterior(anchoPlano, altoPlano, predim, dimen, resultdim, tipoCara);

        if (puntosMalla && puntosMalla.length > 0) {
            // Dibujar la malla con su offset correspondiente
            dibujarMallaAceroInterior(d, puntosMalla, offset.x, offset.y, tipoCara);
            console.log(`✅ Cara ${tipoCara} completada en posición (${offset.x}, ${offset.y})`);
        } else {
            console.error(`❌ Error: No se pudo generar la malla para ${tipoCara}`);
        }
    });

    console.log('🎯 Todas las caras de malla generadas correctamente');
}

const CAD_PATHS = [
    "C:\\Program Files\\Autodesk\\AutoCAD 2025\\acad.exe",
    "C:\\Program Files\\Autodesk\\AutoCAD 2024\\acad.exe",
    "C:\\Program Files\\Autodesk\\AutoCAD 2023\\acad.exe",
    "C:\\Program Files\\Autodesk\\AutoCAD 2022\\acad.exe",
    "C:\\Program Files\\Autodesk\\AutoCAD 2021\\acad.exe",
    "C:\\Program Files\\Autodesk\\AutoCAD 2020\\acad.exe",
    "C:\\Program Files\\Autodesk\\AutoCAD 2019\\acad.exe"
];

// === RUTA PRINCIPAL ===
app.post('/exportar', (req, res) => {
    try {
        console.log('🚀 Iniciando exportación DXF...');
        console.log('📦 Body recibido:', JSON.stringify(req.body, null, 2));

        const { x = 0, y = 0, predim = {}, dimen = {}, resultdim = {} } = req.body;

        // Validar que se recibieron datos
        if (!predim.inputValues && !dimen && !resultdim) {
            console.error('❌ No se recibieron datos válidos');
            return res.status(400).json({
                error: 'No se recibieron datos válidos para generar el plano',
                received: req.body
            });
        }

        const d = new Drawing();
        d.setUnits('Millimeters');

        // === MARCO DEL PLANO ARQUITECTÓNICO ===
        d.addLayer('MARCO', Drawing.ACI.WHITE, 'CONTINUOUS');
        d.setActiveLayer('MARCO');

        // Marco exterior estándar A3 (más grande para acomodar cotas)
        const anchoPlano = 45 + predim.inputValues.B18;
        const altoPlano = 30 + predim.inputValues.B18;

        const marcoExterior = [
            { x: x, y: y },
            { x: x + anchoPlano, y: y },
            { x: x + anchoPlano, y: y + altoPlano },
            { x: x, y: y + altoPlano },
            { x: x, y: y }
        ];
        drawPolyline(d, marcoExterior);

        // Marco interior
        const margen = 0.60;
        const marcoInterior = [
            { x: x + margen, y: y + margen },
            { x: x + anchoPlano - margen, y: y + margen },
            { x: x + anchoPlano - margen, y: y + altoPlano - margen },
            { x: x + margen, y: y + altoPlano - margen },
            { x: x + margen, y: y + margen }
        ];
        drawPolyline(d, marcoInterior);

        // === GENERACIÓN DE PUNTOS DEL MURO ===
        console.log('🔄 Generando puntos del muro...');
        const puntosMuro = generarPuntosMuro(anchoPlano, altoPlano, predim, dimen, resultdim);

        if (puntosMuro.length === 0) {
            console.error('❌ No se pudieron generar puntos del muro');
            return res.status(500).json({ error: 'No se pudieron generar puntos del muro' });
        }
        const puntosMuro3D = generarPuntosMuro3D(anchoPlano, altoPlano, predim, dimen, resultdim);
        //const puntosMallaInterior = generarMallaAceroInterior(anchoPlano, altoPlano, predim, dimen, resultdim);
        // Agregar: refuezos
        // 1. Generar contorno interno (figura rosada/magenta)
        const { trianguloVastago, rectanguloBase } = generarContornoInternoMuro(puntosMuro, 0.05);
        const contornos = { trianguloVastago, rectanguloBase };
        // 2. Generar aceros internos EN EL PERÍMETRO usando los contornos
        const acerosInternos = generarAcerosInternosMuro(
            { trianguloVastago, rectanguloBase },
            0.20 // espaciado base
        );

        // === DIBUJO DE MUROS PROFESIONAL ===
        console.log('🎨 Dibujando muros con cotas profesionales...');

        const espaciadoX = 10; // separación horizontal entre gráficos
        const espaciadoY = 15; // separación vertical entre filas

        // Muro 1: REFUERZO (izquierda)
        const offsetMuro1X = x + margen + 4;
        const offsetMuro1Y = y + margen + 2;

        // 1️⃣ Dibujar muro base (azul)
        dibujarMuroCompleto(d, puntosMuro, offsetMuro1X, offsetMuro1Y, 'REFUERZO', predim, altoPlano);

        // 2️⃣ Dibujar contorno interno (rosado)
        dibujarContornoInterno(d, trianguloVastago, offsetMuro1X, offsetMuro1Y, 'INTERNO_TRIANGULO', 'REFUERZO');

        // Luego el rectángulo (base horizontal)
        dibujarContornoInterno(d, rectanguloBase, offsetMuro1X, offsetMuro1Y, 'INTERNO_RECTANGULO', 'REFUERZO');

        // 3️⃣ Dibujar aceros internos (SOLO puntos amarillos)
        dibujarAcerosInternos(d, acerosInternos, offsetMuro1X, offsetMuro1Y, 'REFUERZO');

        // Agregar estas dos líneas:
        agregarMLeadersEstructuraInterna(d, contornos, offsetMuro1X, offsetMuro1Y);
        agregarCotasLeaderAceros(d, acerosInternos, offsetMuro1X, offsetMuro1Y);

        // Muro 2: DRENAJE (derecha) - más espacio para cotas
        const offsetMuro2X = offsetMuro1X + espaciadoX;
        const offsetMuro2Y = offsetMuro1Y;
        dibujarMuroCompleto(d, puntosMuro, offsetMuro2X, offsetMuro2Y, 'DRENAJE', predim, altoPlano);

        // Muro 3: VISTA 3D (usa los nuevos puntos 3D)
        const offsetMuro3X = offsetMuro2X + espaciadoX; // Espaciado dinámico
        const offsetMuro3Y = offsetMuro1Y;
        dibujarMuroCompleto3D(d, puntosMuro3D, offsetMuro3X, offsetMuro3Y, 'MC3D', predim, altoPlano);

        const offsetCarasY = 1;

        // POR ESTO:
        //Cara 4,5,6,7: ACERO EN TODAS LAS CARAS con offsets específicos
        const offsetMuro4X = offsetMuro1X;
        const offsetMuro4Y = offsetCarasY;
        const offsetMuro5X = offsetMuro2X;
        const offsetMuro5Y = offsetCarasY;
        const offsetMuro6X = offsetMuro3X;
        const offsetMuro6Y = offsetCarasY;
        const offsetMuro7X = offsetMuro3X + espaciadoX;
        const offsetMuro7Y = offsetCarasY;

        // Configurar offsets personalizados manteniendo el orden original
        const offsetsPersonalizados = {
            INTERIOR: { x: offsetMuro4X, y: offsetMuro4Y },
            EXTERIOR: { x: offsetMuro5X, y: offsetMuro5Y },
            INFERIOR: { x: offsetMuro6X, y: offsetMuro6Y },
            SUPERIOR: { x: offsetMuro7X, y: offsetMuro7Y }
        };
        // Generar todas las caras con los offsets específicos
        generarYDibujarTodasLasCaras(d, anchoPlano, altoPlano, predim, dimen, resultdim, offsetsPersonalizados);
        //dibujarMallaAceroInterior(d, puntosMallaInterior, offsetMuro4X, offsetMuro4Y, 'INTERIOR');

        // //Cara 5: ACERO EN CARA EXTERIOR_EJE A-A
        // const offsetMuro5X = offsetMuro2X; // Espaciado dinámico
        // const offsetMuro5Y = offsetCarasY;
        // dibujarMallaAceroInterior(d, puntosMallaInterior, offsetMuro5X, offsetMuro5Y, 'EXTERIOR');

        // //Cara 6: REFUERZO INFERIOR DE ZAPATA
        // const offsetMuro6X = offsetMuro3X; // Espaciado dinámico
        // const offsetMuro6Y = offsetCarasY;
        // dibujarMallaAceroInterior(d, puntosMallaInterior, offsetMuro6X, offsetMuro6Y, 'INFERIOR');

        // //Cara 7: REFUERZO SUPERIOR DE ZAPATA
        // const offsetMuro7X = offsetMuro3X + espaciadoX; // Espaciado dinámico
        // const offsetMuro7Y = offsetCarasY;
        // dibujarMallaAceroInterior(d, puntosMallaInterior, offsetMuro7X, offsetMuro7Y, 'SUPERIOR');

        // === EXPORTACIÓN ===
        const dir = path.resolve(process.cwd(), 'src/documents');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `plano_muro_profesional_${timestamp}.dxf`;
        const filePath = path.join(dir, fileName);

        console.log('💾 Guardando archivo en:', filePath);
        fs.writeFileSync(filePath, d.toDxfString());

        // === RESPUESTA EXITOSA ===
        console.log('✅ Plano generado exitosamente con cotas profesionales');

        // Intentar abrir en AutoCAD (opcional)
        //const autocadPath = "C:\\Program Files\\Autodesk\\AutoCAD 2021\\acad.exe";
        const autocadPath = CAD_PATHS.find(cadPath => fs.existsSync(cadPath));

        if (fs.existsSync(autocadPath)) {
            exec(`"${autocadPath}" "${filePath}"`, (error) => {
                if (error) {
                    console.log('⚠️ No se pudo abrir AutoCAD automáticamente:', error.message);
                } else {
                    console.log('🚀 AutoCAD abierto exitosamente');
                }
            });
        }

        res.json({
            success: true,
            message: '✅ Plano arquitectónico generado exitosamente con cotas profesionales',
            fileName: fileName,
            filePath: filePath,
            puntos: puntosMuro.length,
            parametros: puntosMuro.params,
            estadisticas: {
                capas: ['MARCO', 'MURO_REFUERZO', 'MURO_DRENAJE', 'COTAS_REFUERZO', 'COTAS_DRENAJE', 'TITULO_GENERAL', 'INFO_TECNICA', 'LEYENDA'],
                cotasHorizontales: 6,
                cotasVerticales: 4,
                precision: '±0.01m'
            }
        });

    } catch (error) {
        console.error('❌ Error general en /exportar:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message,
            stack: error.stack
        });
    }
});

// === RUTA PARA VALIDAR PARÁMETROS ===
app.post('/validar-parametros', (req, res) => {
    try {
        const { predim, dimen, resultdim } = req.body;
        const puntosMuro = generarPuntosMuro(predim, dimen, resultdim);

        res.json({
            success: true,
            puntos: puntosMuro.length,
            parametros: puntosMuro.params,
            coordenadas: puntosMuro.map(p => ({ x: p.x, y: p.y, label: p.label }))
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error al validar parámetros',
            details: error.message
        });
    }
});

// === RUTA DE SALUD DEL SERVIDOR ===
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        message: 'Servidor DXF con cotas profesionales funcionando correctamente',
        version: '2.0.0',
        features: ['Cotas automáticas', 'Múltiples capas', 'Validación de parámetros']
    });
});

// ===============================
// 📄 RUTAS PARA MANEJO DE PLANOS
// ===============================
app.get('/api/planos', (req, res) => {
    fs.readdir(DOCUMENTS_DIR, (err, files) => {
        if (err) return res.status(500).json({ error: 'Error leyendo documentos' });

        const planos = files
            .filter(file => file.endsWith('.dxf'))
            .map(file => ({
                name: file,
                url: `/documents/${file}`,
                timestamp: fs.statSync(path.join(DOCUMENTS_DIR, file)).mtime
            }));

        res.json(planos);
    });
});

app.get('/api/abrir/:filename', (req, res) => {
    const fileName = req.params.filename;
    const filePath = path.join(DOCUMENTS_DIR, fileName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'Archivo no encontrado' });
    }

    // Buscar versión instalada de AutoCAD
    const installedCAD = CAD_PATHS.find(cadPath => fs.existsSync(cadPath));

    if (!installedCAD) {
        return res.status(500).json({
            success: false,
            message: '❌ No se encontró ninguna versión de AutoCAD instalada (2019–2025). Instala AutoCAD para abrir planos.'
        });
    }

    exec(`"${installedCAD}" "${filePath}"`, (error) => {
        if (error) {
            console.error('⚠️ Error al abrir AutoCAD:', error.message);
            return res.status(500).json({ success: false, message: 'Error al ejecutar AutoCAD' });
        }

        console.log(`🚀 AutoCAD abierto con archivo: ${fileName}`);
        return res.json({
            success: true,
            message: 'Plano abierto exitosamente en AutoCAD',
            version: path.basename(installedCAD)
        });
    });
});

app.delete('/api/planos_delete/:nombre', (req, res) => {
    const nombre = req.params.nombre;
    const filePath = path.join(DOCUMENTS_DIR, nombre);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Plano no encontrado' });
    }

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('❌ Error eliminando archivo:', err);
            return res.status(500).json({ error: 'Error eliminando el archivo' });
        }

        console.log(`🗑️ Plano eliminado: ${nombre}`);
        res.json({ success: true, message: 'Plano eliminado correctamente' });
    });
});

// === MIDDLEWARE DE MANEJO DE ERRORES ===
app.use((error, req, res, next) => {
    console.error('❌ Error no manejado:', error);
    res.status(500).json({
        error: 'Error interno del servidor',
        message: error.message
    });
});

// === SERVIDOR ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🟢 Servidor de planos arquitectónicos activo en puerto ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📡 Endpoint DXF: http://localhost:${PORT}/exportar`);
});