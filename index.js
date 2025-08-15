import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import Drawing from 'dxf-writer';
import { publicDecrypt } from 'crypto';

const __dirname = path.resolve();
const app = express();

app.use(cors());
app.use(express.json());

// ====================================
// 1. CONFIGURACIONES Y CONSTANTES
// ====================================

const CONFIG = {
    DIRECTORIES: {
        DOCUMENTS: path.join(__dirname, 'src/documents')
    },

    DRAWING: {
        UNITS: 'Millimeters',
        MARGIN: 0.60,
        SPACING: {
            X: 10,
            Y: 15
        }
    },

    LAYERS: {
        MARCO: { color: Drawing.ACI.WHITE, lineType: 'CONTINUOUS' },
        MARCOINTERIOR: { color: Drawing.ACI.WHITE, lineType: 'CONTINUOUS' },
        //mebretes
        MEMBRETEGENERAL: { color: Drawing.ACI.WHITE, lineType: 'CONTINUOUS' },
        MEMBRETE_IMAGEN: { color: Drawing.ACI.WHITE, lineType: 'CONTINUOUS' },
        MEMBRETE_INSTITUCION: { color: Drawing.ACI.WHITE, lineType: 'CONTINUOUS' },
        MEMBRETE_INFO_PROYECTO: { color: Drawing.ACI.WHITE, lineType: 'CONTINUOUS' },
        MEMBRETE_TIPO_PROYECTO: { color: Drawing.ACI.WHITE, lineType: 'CONTINUOUS' },
        MEMBRETE_UBICACION: { color: Drawing.ACI.WHITE, lineType: 'CONTINUOUS' },
        MEMBRETE_ESPECIALISTA: { color: Drawing.ACI.WHITE, lineType: 'CONTINUOUS' },
        MEMBRETE_FECHA_ESCALA_LAMINA: { color: Drawing.ACI.WHITE, lineType: 'CONTINUOUS' },
        //muros
        MURO: { color: Drawing.ACI.BLUE, lineType: 'CONTINUOUS' },
        COTAS: { color: Drawing.ACI.YELLOW, lineType: 'CONTINUOUS' },
        ACERO: { color: Drawing.ACI.YELLOW, lineType: 'CONTINUOUS' },
        CONTORNO: { color: Drawing.ACI.MAGENTA, lineType: 'CONTINUOUS' },
        SUELO: { color: Drawing.ACI.GREEN, lineType: 'DASHED' },
        TUBO: { color: Drawing.ACI.RED, lineType: 'CONTINUOUS' }
    },

    ACERO: {
        TIPOS: {
            INTERIOR: { diametro: '3/8', cantidad: 1, color: 'GREEN' },
            EXTERIOR: { diametro: '3/8', cantidad: 1, color: 'GREEN' },
            INFERIOR: { diametro: '1/2', cantidad: 1, color: 'CYAN' },
            SUPERIOR: { diametro: '1/2', cantidad: 1, color: 'CYAN' }
        },
        ESPACIADO: {
            GENERAL: 0.20,
            SUPERIOR: 0.17,
            INFERIOR: 0.20
        }
    },

    CAD_PATHS: [
        "C:\\Program Files\\Autodesk\\AutoCAD 2025\\acad.exe",
        "C:\\Program Files\\Autodesk\\AutoCAD 2024\\acad.exe",
        // ... más rutas
    ]
};

// ====================================
// 2. UTILIDADES Y HELPERS
// ====================================

class ValidationUtils {
    static validateNumber(value, defaultValue = 0) {
        const num = parseFloat(value);
        return isNaN(num) ? defaultValue : num;
    }

    // ✅ ARREGLO: Validación más robusta
    static validateDrawingData(predim, dimen, resultdim) {
        if (!predim || !predim.inputValues || typeof predim.inputValues !== 'object') {
            console.error('❌ predim.inputValues no es válido');
            return false;
        }

        // Validar que existan los campos críticos
        const requiredFields = ['B18', 'B19', 'D51', 'D47', 'D49', 'D45'];
        for (const field of requiredFields) {
            if (predim.inputValues[field] === undefined || predim.inputValues[field] === null) {
                console.error(`❌ Campo requerido faltante: ${field}`);
                return false;
            }
        }

        return true;
    }
}

class GeometryUtils {
    static calculateDistance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    static displacePoints(points, offsetX, offsetY) {
        return points.map(p => ({
            x: p.x + offsetX,
            y: p.y + offsetY,
            label: p.label
        }));
    }
}

// ====================================
// 3. GENERADORES DE GEOMETRÍA
// ====================================
class WallGeometryGenerator {
    static generateWallPoints(anchoPlano, altoPlano, predim, dimen, resultdim) {
        try {
            // Extraer valores con validación
            const B18 = ValidationUtils.validateNumber(predim.inputValues.B18, 6.4);
            const B19 = ValidationUtils.validateNumber(predim.inputValues.B19, 1);
            const D51 = ValidationUtils.validateNumber(predim.inputValues.D51, 0.1);
            const D47 = ValidationUtils.validateNumber(predim.inputValues.D47, 10);
            const D49 = ValidationUtils.validateNumber(predim.inputValues.D49, 8);
            const D45 = ValidationUtils.validateNumber(predim.inputValues.D45, 0.3);

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
            return points;
        } catch (error) {
            console.error('❌ Error al generar puntos del muro:', error);
            return [];
        }
    }

    static generateWall3DPoints(anchoPlano, altoPlano, predim, dimen, resultdim) {
        try {
            // Extraer valores con validación
            const B18 = ValidationUtils.validateNumber(predim.inputValues.B18, 6.4);
            const B19 = ValidationUtils.validateNumber(predim.inputValues.B19, 1);
            const D51 = ValidationUtils.validateNumber(predim.inputValues.D51, 0.1);
            const D47 = ValidationUtils.validateNumber(predim.inputValues.D47, 10);
            const D49 = ValidationUtils.validateNumber(predim.inputValues.D49, 8);
            const D45 = ValidationUtils.validateNumber(predim.inputValues.D45, 0.3);

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

            return points;
        } catch (error) {
            console.error('❌ Error al generar puntos del muro:', error);
            return [];
        }
    }

    static generateInternalContour(wallPoints, coverage = 0.05) {
        try {

            if (!wallPoints || wallPoints.length === 0) {
                console.error('❌ No se recibieron puntos del muro');
                return {};
            }

            const p = wallPoints;
            const rectangleBase = [];
            const triangleStalk = [];

            // === TRIÁNGULO VERTICAL (cara interior del muro) ===

            const alturaInterior = p[2].y - p[3].y;

            // Punto base superior sobre p[6], subiendo con la altura desde p[2] a p[3]
            triangleStalk.push({
                x: p[6].x + coverage,
                y: p[1].y + coverage,
                label: `TV1-${p[6].label.split('-')[1]} interno`
            });

            // p[3] ajustado (cara interior vertical)
            triangleStalk.push({
                x: p[3].x - coverage,
                y: p[1].y + coverage,
                label: `TV2-${p[3].label.split('-')[1]} interno`
            });

            // p[4] ajustado
            triangleStalk.push({
                x: p[4].x - coverage,
                y: p[4].y - coverage,
                label: `TV3-${p[4].label.split('-')[1]} interno`
            });

            // p[5] ajustado
            triangleStalk.push({
                x: p[5].x + coverage,
                y: p[5].y - coverage,
                label: `TV4-${p[5].label.split('-')[1]} interno`
            });

            // p[6] ajustado
            triangleStalk.push({
                x: p[6].x + coverage,
                y: p[6].y - coverage,
                label: `TV5-${p[6].label.split('-')[1]} interno`
            });

            // Cierre (igual que primer punto)
            triangleStalk.push({
                x: p[6].x + coverage,
                y: p[1].y + coverage,
                label: `TV1-${p[6].label.split('-')[1]} interno`
            });

            // === RECTÁNGULO HORIZONTAL (base/zapata del muro) ===
            rectangleBase.push({
                x: p[0].x + coverage,
                y: p[0].y + coverage,
                label: `RB1-${p[0].label.split('-')[1]} interno`
            });
            rectangleBase.push({
                x: p[1].x - coverage,
                y: p[1].y + coverage,
                label: `RB2-${p[1].label.split('-')[1]} interno`
            });
            rectangleBase.push({
                x: p[2].x - coverage,
                y: p[2].y - coverage,
                label: `RB3-${p[2].label.split('-')[1]} interno`
            });
            rectangleBase.push({
                x: p[7].x + coverage,
                y: p[7].y - coverage,
                label: `RB4-${p[7].label.split('-')[1]} interno`
            });
            rectangleBase.push({ // cierre
                x: p[0].x + coverage,
                y: p[0].y + coverage,
                label: 'RB5-Cierre interno'
            });

            // Añadir metadatos
            triangleStalk.params = {
                tipo: 'CONTORNO_INTERNO_TRIANGULO',
                coverage,
                puntosOriginales: wallPoints.length,
                puntosInternos: triangleStalk.length
            };

            rectangleBase.params = {
                tipo: 'CONTORNO_INTERNO_RECTANGULO',
                coverage,
                puntosOriginales: wallPoints.length,
                puntosInternos: rectangleBase.length
            };
            return {
                triangleStalk,
                rectangleBase,
                // trianguloVastago,
                // rectanguloBase
            };
        } catch (error) {
            console.error('❌ Error al generar contornos internos:', error);
            return {};
        }
    }
}

class SteelGenerator {

    static generateInternalSteel(contours, generalSpacing = 0.20) {
        // Genera aceros internos del muro
        // Tu función generarAcerosInternosMuro() va aquí
        if (!contours || !contours.triangleStalk || !contours.rectangleBase) {
            console.error('❌ No se recibieron contornos válidos para generar aceros');
            return { rectangulo: [], triangulo: [] };
        }

        //         rectangle: [],
        // triangle: []
        const aceros = {
            rectangle: [],
            triangle: []
        };

        const { triangleStalk, rectangleBase } = contours;

        // === ACEROS SOLO EN BORDES SUPERIOR E INFERIOR DEL RECTÁNGULO ===
        const rectanguloPerimetro = rectangleBase.slice(0, -1); // Quitar el punto de cierre

        // Lado superior del rectángulo: Acero 3/8" @ 17cm
        const espaciadoSuperior = 0.17;
        const ladoSuperior = this.calculateSteelAlongLine(
            rectanguloPerimetro[2], // punto superior izquierdo
            rectanguloPerimetro[3], // punto superior derecho
            espaciadoSuperior,
            "3/8",
            "rectangulo_superior"
        );
        aceros.rectangle.push(...ladoSuperior);

        // Lado inferior del rectángulo: Acero 1/2" @ 20cm
        const espaciadoInferior = 0.20;
        const ladoInferior = this.calculateSteelAlongLine(
            rectanguloPerimetro[0], // punto inferior izquierdo
            rectanguloPerimetro[1], // punto inferior derecho
            espaciadoInferior,
            "1/2",
            "rectangulo_inferior"
        );
        aceros.rectangle.push(...ladoInferior);

        // === ACEROS SOLO EN LADOS IZQUIERDO Y DERECHO DEL TRIÁNGULO ===
        const trianguloPerimetro = triangleStalk.slice(0, -1); // Quitar el punto de cierre

        // Lado izquierdo del triángulo: del punto 0 al punto 2
        const ladoIzquierdo = this.calculateSteelAlongLine(
            trianguloPerimetro[0],
            trianguloPerimetro[3],
            0.20,
            "1/2",
            "triangulo_izquierdo"
        );
        aceros.triangle.push(...ladoIzquierdo);

        // Lado derecho del triángulo: del punto 2 al punto 1
        const ladoDerecho = this.calculateSteelAlongLine(
            trianguloPerimetro[2],
            trianguloPerimetro[1],
            0.20,
            "3/8",
            "triangulo_derecho"
        );
        aceros.triangle.push(...ladoDerecho);

        return aceros;
    }

    static generateSteelMesh(anchoPlano, altoPlano, predim, dimen, resultdim, faceType = 'INTERIOR') {
        // Tu función generarMallaAceroInterior() va aquí
        const B18 = ValidationUtils.validateNumber(predim.inputValues.B18, 6.4);
        const B19 = ValidationUtils.validateNumber(predim.inputValues.B19, 1);
        const D51 = ValidationUtils.validateNumber(predim.inputValues.D51, 0.1);
        const D49 = ValidationUtils.validateNumber(predim.inputValues.D49, 8);

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
            // Obtener configuración específica para el tipo de cara
            const config = CONFIGURACION_CARAS[faceType];
            if (!config) {
                console.error(`❌ Configuración no encontrada para tipo: ${faceType}`);
                return [];
            }

            // Dimensiones específicas según el tipo de cara
            const anchoMalla = config.ancho;
            const altoMalla = config.alto;
            const espaciadoGrid = config.espaciado;

            // Posición inicial adaptativa
            const xInicioMalla = 1;
            const yInicioMalla = (faceType === 'INTERIOR' || faceType === 'EXTERIOR' || faceType === 'INFERIOR' || faceType === 'SUPERIOR') ? 2 : 4;
            const xFinMalla = xInicioMalla + anchoMalla;
            const yFinMalla = yInicioMalla + altoMalla;

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
                tipoCara: faceType,
                tipoRefuerzo: 'MALLA_CUADRICULADA',
                configuracion: config,
                acero: CONFIG.ACERO.TIPOS[faceType],
                anchoTotal: anchoMalla,
                altoTotal: altoMalla,
                espaciadoGrid: espaciadoGrid,
                numeroLineasVerticales: numeroLineasVerticales + 1,
                numeroLineasHorizontales: numeroLineasHorizontales + 1,
                xMin: xInicioMalla, xMax: xFinMalla,
                yMin: yInicioMalla, yMax: yFinMalla
            };

            return todasLasLineas;

        } catch (error) {
            console.error(`❌ Error generando malla ${faceType}:`, error);
            return [];
        }
    }

    static calculateSteelAlongLine(startPoint, endPoint, spacing, diameter, zone) {
        // Calcula aceros a lo largo de una línea
        // Tu función calcularAcerosEnLinea() va aquí
        const aceros = [];

        // Vector de dirección
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const longitud = Math.sqrt(dx * dx + dy * dy);

        if (longitud === 0) return [];

        const ux = dx / longitud; // unitario en x
        const uy = dy / longitud; // unitario en y

        // Desplazamiento de 0.1 en dirección de la línea
        const desplazamiento = 0.1;

        const nuevoInicio = {
            x: startPoint.x + desplazamiento * ux,
            y: startPoint.y + desplazamiento * uy
        };

        const nuevoFin = {
            x: endPoint.x - desplazamiento * ux,
            y: endPoint.y - desplazamiento * uy
        };

        const dxNuevo = nuevoFin.x - nuevoInicio.x;
        const dyNuevo = nuevoFin.y - nuevoInicio.y;
        const longitudUtil = Math.sqrt(dxNuevo * dxNuevo + dyNuevo * dyNuevo);

        const numeroAceros = Math.floor(longitudUtil / spacing) + 1;

        for (let i = 0; i < numeroAceros; i++) {
            const t = i / Math.max(1, numeroAceros - 1);
            const x = nuevoInicio.x + t * dxNuevo;
            const y = nuevoInicio.y + t * dyNuevo;

            aceros.push({
                x: x,
                y: y,
                diametro: diameter,
                zona: zone,
                etiqueta: `${zone}_${i + 1}`
            });
        }

        return aceros;
    }
}

// ====================================
// 4. SISTEMA DE DIBUJADO
// ====================================

class DrawingSystem {
    constructor(drawing) {
        this.d = drawing;
        this.setupLayers();
    }

    setupLayers() {
        Object.entries(CONFIG.LAYERS).forEach(([name, config]) => {
            this.d.addLayer(name, config.color, config.lineType);
        });
    }

    drawPolyline(points) {
        if (!points || points.length < 2) return;

        for (let i = 0; i < points.length - 1; i++) {
            if (points[i] && points[i + 1]) {
                this.d.drawLine(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
            }
        }
    }

    drawFrame(x, y, width, height) {
        // ===== DEFINIR ESTILOS DE TEXTO CON ARIAL =====
        this.definirEstilosTexto();

        // ===== MARCO PRINCIPAL =====
        const frame = [
            { x: x, y: y },
            { x: x + width, y: y },
            { x: x + width, y: y + height },
            { x: x, y: y + height },
            { x: x, y: y }
        ];

        this.d.setActiveLayer('MARCO');
        this.drawPolyline(frame);

        // ===== MARCO INTERNO =====
        const margen = 0.60;
        const frameInterno = [
            { x: x + margen, y: y + margen },
            { x: x + width - margen, y: y + margen },
            { x: x + width - margen, y: y + height - margen },
            { x: x + margen, y: y + height - margen },
            { x: x + margen, y: y + margen }
        ];

        this.d.setActiveLayer('MARCOINTERIOR');
        this.drawPolyline(frameInterno);

        // ===== MEMBRETE GENERAL =====
        const anchoMembrete = 8;
        const xInicio = frameInterno[1].x; // borde derecho interno
        const yInicio = frameInterno[0].y; // parte inferior interna
        const ySuperior = y + height - margen; // borde superior interno

        const membrete = [
            { x: xInicio, y: yInicio },
            { x: xInicio - anchoMembrete, y: yInicio },
            { x: xInicio - anchoMembrete, y: ySuperior },
            { x: xInicio, y: ySuperior },
            { x: xInicio, y: yInicio }
        ];

        this.d.setActiveLayer('MEMBRETEGENERAL');
        this.drawPolyline(membrete);

        // ===== DIBUJAR SECCIONES DEL MEMBRETE =====
        this.dibujarSeccionesMembrete(xInicio, yInicio, ySuperior, anchoMembrete);
    }

    // ===== MÉTODO PARA DEFINIR ESTILOS DE TEXTO =====
    definirEstilosTexto() {
        try {
            // Definir estilos de texto con fuente Arial (tamaños aumentados)
            if (this.d.addTextStyle) {
                this.d.addTextStyle('ARIAL_GRANDE', 'arial.ttf', {
                    height: 0.0,
                    widthFactor: 1.0,
                    obliqueAngle: 0.0
                });

                this.d.addTextStyle('ARIAL_MEDIANO', 'arial.ttf', {
                    height: 0.0,
                    widthFactor: 1.0,
                    obliqueAngle: 0.0
                });

                this.d.addTextStyle('ARIAL_PEQUENO', 'arial.ttf', {
                    height: 0.0,
                    widthFactor: 1.0,
                    obliqueAngle: 0.0
                });
            }
        } catch (error) {
            console.warn('No se pudieron crear los estilos de texto Arial:', error.message);
        }
    }

    // ===== MÉTODO PRINCIPAL PARA DIBUJAR SECCIONES =====
    dibujarSeccionesMembrete(xInicio, yInicio, ySuperior, anchoMembrete) {
        const proporciones = [
            { nombre: 'IMAGEN', ratio: 2.28 },
            { nombre: 'INSTITUCION', ratio: 2.28 },
            { nombre: 'INFO_PROYECTO', ratio: 6.66 },
            { nombre: 'TIPO_PROYECTO', ratio: 1.78 },
            { nombre: 'UBICACION', ratio: 1.62 },
            { nombre: 'ESPECIALISTA', ratio: 1.70 },
            { nombre: 'FECHA_ESCALA_LAMINA', ratio: 1.77 }
        ];

        const totalRatio = proporciones.reduce((sum, s) => sum + s.ratio, 0);
        const altoDisponible = ySuperior - yInicio;
        let yActual = ySuperior;

        proporciones.forEach((seccion, index) => {
            const alturaReal = (seccion.ratio / totalRatio) * altoDisponible;
            const yInferior = yActual - alturaReal;

            // Dibujar rectángulo de cada sección
            this.dibujarRectanguloSeccion(xInicio, yInferior, yActual, anchoMembrete, seccion.nombre);

            // Agregar contenido según el tipo de sección
            const xIzquierda = (xInicio - anchoMembrete) + 0.3;
            const xDerecha = xInicio - 0.3;
            const anchoUtil = xDerecha - xIzquierda;
            const altoUtil = alturaReal - 0.4;

            this.procesarContenidoSeccion(
                seccion.nombre,
                xIzquierda,
                xDerecha,
                yInferior + 0.2,
                yActual - 0.2,
                anchoUtil,
                altoUtil
            );

            yActual = yInferior;
        });
    }

    // ===== MÉTODO PARA DIBUJAR RECTÁNGULO DE SECCIÓN =====
    dibujarRectanguloSeccion(xInicio, yInferior, yActual, anchoMembrete, nombreSeccion) {
        const subRect = [
            { x: xInicio - 0.2, y: yInferior + 0.2 },
            { x: (xInicio - anchoMembrete) + 0.2, y: yInferior + 0.2 },
            { x: (xInicio - anchoMembrete) + 0.2, y: yActual - 0.2 },
            { x: xInicio - 0.2, y: yActual - 0.2 },
            { x: xInicio - 0.2, y: yInferior + 0.2 }
        ];

        this.d.setActiveLayer(`MEMBRETE_${nombreSeccion}`);
        this.drawPolyline(subRect);
    }

    // ===== MÉTODO PARA PROCESAR CONTENIDO DE CADA SECCIÓN =====
    procesarContenidoSeccion(nombreSeccion, xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto) {
        const layerInfo = `CONTENIDO_${nombreSeccion}`;
        this.d.addLayer(layerInfo, Drawing.ACI.WHITE, 'CONTINUOUS');
        this.d.setActiveLayer(layerInfo);

        switch (nombreSeccion) {
            case 'IMAGEN':
                this.membreteImagen(xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto);
                break;
            case 'INSTITUCION':
                this.membreteInstitucion(xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto);
                break;
            case 'INFO_PROYECTO':
                this.membreteInfoProyecto(xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto);
                break;
            case 'TIPO_PROYECTO':
                this.membreteTipoProyecto(xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto);
                break;
            case 'UBICACION':
                this.membreteUbicacion(xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto);
                break;
            case 'ESPECIALISTA':
                this.membreteEspecialista(xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto);
                break;
            case 'FECHA_ESCALA_LAMINA':
                this.membreteFechaEscalaLamina(xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto);
                break;
        }
    }

    // ===== MEMBRETES SEPARADOS =====

    membreteImagen(xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto) {
        const centroX = xIzquierda + (ancho / 2);
        const centroY = yInferior + (alto / 2);

        // Por ahora texto indicativo - aquí iría la imagen
        this.d.drawText(centroX - (ancho / 4), centroY, 0.15, 0, '[LOGO]');
    }

    membreteInstitucion(xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto) {
        const config = {
            alturaTitulo: 0.11,       // tamaño texto título
            alturaDescripcion: 0.16,  // tamaño texto descripción
            margen: 0.05
        };

        // Dibujar título y descripción centrada
        const titulo = ""; // No hay título en este caso
        const descripcion = "MUNICIPALIDAD DISTRITAL\nDE SINGA";

        // Calculamos posición vertical (centrado en todo el bloque)
        const yCentro = (ySuperior + yInferior) / 2 - (config.alturaDescripcion / 2);
        const xCentro = (xIzquierda + xDerecha) / 2;

        // Si hubiera título
        if (titulo) {
            this.d.drawText(
                xIzquierda + config.margen,
                ySuperior - config.margen - config.alturaTitulo,
                config.alturaTitulo,
                0,
                titulo
            );
        }

        // Dividimos la descripción en líneas si contiene saltos \n
        const lineas = descripcion.split("\n");
        let yActual = yCentro + (lineas.length - 1) * (config.alturaDescripcion / 2);

        lineas.forEach(linea => {
            const anchoTexto = this.calcularAnchoTexto(linea, config.alturaDescripcion);
            this.d.drawText(
                xCentro - (anchoTexto / 2),
                yActual,
                config.alturaDescripcion,
                0,
                linea
            );
            yActual -= config.alturaDescripcion; // bajar para la siguiente línea
        });
    }

    membreteInfoProyecto(xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto) {
        const contenido = {
            textos: [
                {
                    subtitle: "NOMBRE DEL PROYECTO:",
                    descripcion: "MEJORAMIENTO DE LOS SERVICIOS EDUCATIVOS EN LA INSTITUCIÓN EDUCATIVA DEL NIVEL SECUNDARIA Nº 32478 DE LA LOCALIDAD DE SANTA ROSA DE PAMPAN, DISTRITO DE SINGA, PROVINCIA DE HUAMALIES, DEPARTAMENTO DE HUANUCO"
                },
                { subtitle: "INSTITUCION EDUCATIVA:", descripcion: "I.E N°32478" },
                { subtitle: "CODIGO LOCAL:", descripcion: "201188" },
                { subtitle: "CODIGO UNIFICADO:", descripcion: "----------" },
                { subtitle: "CODIGO DEL PROYECTO:", descripcion: "-----------" }
            ],
            tamaño: 'mediano'
        };

        // Configuración de tamaños
        const configTamaño = {
            pequeño: { alturaTitulo: 0.11, alturaDescripcion: 0.14, margen: 0.05, saltoLinea: 0.16 },
            mediano: { alturaTitulo: 0.13, alturaDescripcion: 0.17, margen: 0.06, saltoLinea: 0.19 },
            grande: { alturaTitulo: 0.15, alturaDescripcion: 0.20, margen: 0.07, saltoLinea: 0.22 }
        };

        const config = configTamaño[contenido.tamaño] || configTamaño.pequeño;
        const altoSeccion = alto / contenido.textos.length;
        const maxAnchoTexto = xDerecha - xIzquierda - config.margen * 2;

        // Función auxiliar para partir texto automáticamente
        const partirTextoEnLineas = (texto, alturaTexto, maxAncho, maxCaracteres = 35) => {
            const palabras = texto.split(" ");
            const lineas = [];
            let lineaActual = "";

            palabras.forEach(palabra => {
                const testLinea = lineaActual ? lineaActual + " " + palabra : palabra;
                const anchoLinea = this.calcularAnchoTexto(testLinea, alturaTexto - 0.5);

                // Verificamos tanto el ancho como la cantidad de caracteres
                if (anchoLinea <= maxAncho && testLinea.length <= maxCaracteres) {
                    lineaActual = testLinea;
                } else {
                    if (lineaActual) lineas.push(lineaActual);
                    lineaActual = palabra;
                }
            });

            if (lineaActual) lineas.push(lineaActual);
            return lineas;
        };

        const dibujarSeccion = (titulo, descripcion, yTop, yBottom) => {
            // Título arriba a la izquierda
            this.d.drawText(
                xIzquierda + config.margen,
                yTop - config.margen - config.alturaTitulo,
                config.alturaTitulo,
                0,
                titulo
            );

            // Dividir descripción en líneas
            let lineas = [];
            descripcion.split("\n").forEach(parte => {
                const subLineas = partirTextoEnLineas(parte.trim(), config.alturaDescripcion, maxAnchoTexto);
                lineas = lineas.concat(subLineas);
            });

            // Calcular posición vertical para centrar el bloque de texto
            const altoTotalTexto = (lineas.length - 1) * config.saltoLinea;
            let yLinea = (yTop + yBottom) / 2 + altoTotalTexto / 2;

            // Dibujar cada línea centrada
            lineas.forEach(linea => {
                const xCentro = (xIzquierda + xDerecha) / 2;
                this.d.drawText(
                    xCentro - (this.calcularAnchoTexto(linea, config.alturaDescripcion) / 2),
                    yLinea,
                    config.alturaDescripcion,
                    0,
                    linea
                );
                yLinea -= config.saltoLinea;
            });
        };

        // Dibujar cada bloque de información
        contenido.textos.forEach((item, index) => {
            const yTop = ySuperior - (altoSeccion * index);
            const yBottom = ySuperior - (altoSeccion * (index + 1));
            dibujarSeccion(item.subtitle, item.descripcion, yTop, yBottom);
        });
    }

    membreteTipoProyecto(xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto) {
        const contenido = {
            textos: [
                { subtitle: "BLOQUE:", descripcion: "OE-E01" },
                { subtitle: "PLANO DE:", descripcion: "ESTRUCTURAS" },
                { subtitle: "ESPECIALIDAD:", descripcion: "ESTRUCTURAS" }
            ],
            tamaño: 'pequeño'
        };

        // Configuración de tamaños de texto según 'tamaño'
        const configTamaño = {
            pequeño: { alturaTitulo: 0.11, alturaDescripcion: 0.14, margen: 0.05 },
            mediano: { alturaTitulo: 0.13, alturaDescripcion: 0.17, margen: 0.06 },
            grande: { alturaTitulo: 0.15, alturaDescripcion: 0.20, margen: 0.07 }
        };

        const config = configTamaño[contenido.tamaño] || configTamaño.pequeño;

        // Altura por sección
        const altoSeccion = alto / contenido.textos.length;

        // Función para dibujar cada bloque
        const dibujarSeccion = (titulo, descripcion, yTop, yBottom) => {
            // Título alineado a la izquierda
            this.d.drawText(
                xIzquierda + config.margen,
                yTop - config.margen - config.alturaTitulo,
                config.alturaTitulo,
                0,
                titulo
            );

            // Descripción centrada
            const yCentro = (yTop + yBottom) / 2 - (config.alturaDescripcion / 2);
            const xCentro = (xIzquierda + xDerecha) / 2;

            this.d.drawText(
                xCentro - (this.calcularAnchoTexto(descripcion, config.alturaDescripcion) / 2),
                yCentro,
                config.alturaDescripcion,
                0,
                descripcion
            );
        };

        // Dibujar divisiones y secciones
        contenido.textos.forEach((item, index) => {
            const yTop = ySuperior - (altoSeccion * index);
            const yBottom = ySuperior - (altoSeccion * (index + 1));

            // Dibujar línea divisoria (excepto la última)
            if (index > 0) {
                this.d.drawLine(xIzquierda, yTop, xDerecha, yTop);
            }

            dibujarSeccion(item.subtitle, item.descripcion, yTop, yBottom);
        });
    }

    membreteUbicacion(xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto) {
        const config = {
            alturaTitulo: 0.11,  // tamaño texto título
            alturaDescripcion: 0.14, // tamaño texto descripción
            margen: 0.05
        };

        // Dividir en tres secciones iguales
        const altoSeccion = alto / 3;

        const yPrimeraDivision = ySuperior - altoSeccion;
        const ySegundaDivision = ySuperior - altoSeccion * 2;

        // Dibujar líneas divisorias
        this.d.drawLine(xIzquierda, yPrimeraDivision, xDerecha, yPrimeraDivision);
        this.d.drawLine(xIzquierda, ySegundaDivision, xDerecha, ySegundaDivision);

        // Función auxiliar para dibujar título y descripción
        const dibujarSeccion = (titulo, descripcion, yTop, yBottom) => {
            // Título alineado a la izquierda
            this.d.drawText(
                xIzquierda + config.margen,
                yTop - config.margen - config.alturaTitulo,
                config.alturaTitulo,
                0,
                titulo
            );

            // Descripción centrada en la sección
            const yCentro = (yTop + yBottom) / 2 - (config.alturaDescripcion / 2);
            const xCentro = (xIzquierda + xDerecha) / 2;

            this.d.drawText(
                xCentro - (this.calcularAnchoTexto(descripcion, config.alturaDescripcion) / 2),
                yCentro,
                config.alturaDescripcion,
                0,
                descripcion
            );
        };

        // Sección 1: DISTRITO
        dibujarSeccion("DISTRITO:", "HUÁNUCO", ySuperior, yPrimeraDivision);

        // Sección 2: PROVINCIA
        dibujarSeccion("PROVINCIA:", "HUÁNUCO", yPrimeraDivision, ySegundaDivision);

        // Sección 3: REGIÓN
        dibujarSeccion("REGIÓN:", "HUÁNUCO", ySegundaDivision, yInferior);
    }

    membreteEspecialista(xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto) {
        // Configuración para el membrete de especialista
        const config = {
            alturaTexto: 0.11,
            margen: 0.05
        };

        // ===== DIVIDIR EL ÁREA EN DOS PARTES IGUALES =====
        const altoTotal = alto;
        const altoSeccion = altoTotal / 2;

        // Coordenadas de las dos secciones
        const yMedio = yInferior + altoSeccion; // Línea divisoria horizontal

        // ===== DIBUJAR LÍNEA DIVISORIA HORIZONTAL =====
        this.d.drawLine(xIzquierda, yMedio, xDerecha, yMedio);

        // ===== SECCIÓN SUPERIOR: ESPECIALISTA =====
        const yCentroSuperior = (yMedio + ySuperior) / 2;
        const textoEspecialista = "Especialista:";
        const anchoEspecialista = this.calcularAnchoTexto(textoEspecialista, config.alturaTexto);
        const xCentroEspecialista = xIzquierda + (ancho / 2);

        // Posicionar "Especialista:" en la esquina superior izquierda de su sección
        this.d.drawText(
            xIzquierda + config.margen,
            ySuperior - config.margen - config.alturaTexto,
            config.alturaTexto,
            0,
            textoEspecialista
        );

        // ===== SECCIÓN INFERIOR: FIRMA Y SELLO =====
        const yCentroInferior = (yInferior + yMedio) / 2;
        const textoFirma = "Firma y sello:";
        const anchoFirma = this.calcularAnchoTexto(textoFirma, config.alturaTexto);

        // Posicionar "Firma y sello:" en la esquina superior izquierda de su sección
        this.d.drawText(
            xIzquierda + config.margen,
            yMedio - config.margen - config.alturaTexto,
            config.alturaTexto,
            0,
            textoFirma
        );
    }

    membreteFechaEscalaLamina(xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto) {
        // Configuración especial para este membrete con layout estructurado
        const config = {
            alturaTexto: 0.12,
            alturaTextoLamina: 0.35, // Texto más grande para "E-1"
            margen: 0.05
        };

        // ===== DIVIDIR EL ÁREA EN SECCIONES =====
        const anchoTotal = ancho;
        const altoTotal = alto;

        // Dividir verticalmente: 75% para tabla, 25% para lámina
        const anchoTabla = anchoTotal * 0.65;
        const anchoLamina = anchoTotal * 0.35;

        // Coordenadas de las áreas
        const xTabla = xIzquierda;
        const xLamina = xIzquierda + anchoTabla;

        // ===== DIBUJAR LÍNEAS DIVISORIAS =====

        // Línea vertical principal (separa tabla de lámina)
        this.d.drawLine(xLamina, yInferior, xLamina, ySuperior);

        // Dividir la tabla en 3 filas
        const altoFila = altoTotal / 3;
        const yFila1 = ySuperior - altoFila;     // Entre Fecha y Escala
        const yFila2 = ySuperior - (altoFila * 2); // Entre Escala y Diseño CAD

        // Líneas horizontales para dividir las filas
        this.d.drawLine(xTabla, yFila1, xLamina, yFila1);
        this.d.drawLine(xTabla, yFila2, xLamina, yFila2);

        // Línea vertical para separar labels de valores (en 40% - 60%)
        const xDivisionTabla = xTabla + (anchoTabla * 0.4);
        //this.d.drawLine(xDivisionTabla, yInferior, xDivisionTabla, ySuperior);

        // ===== AGREGAR CONTENIDO DE LA TABLA =====
        const datosTabla = [
            { label: "Fecha:", valor: "2024" },
            { label: "Escala:", valor: "INDICADA" },
            { label: "Diseño Cad:", valor: "ADHO" }
        ];

        datosTabla.forEach((dato, index) => {
            const yFilaActual = ySuperior - (altoFila * index);
            const yFilaSiguiente = ySuperior - (altoFila * (index + 1));
            const yCentroFila = (yFilaActual + yFilaSiguiente) / 2;

            // Label (izquierda)
            //const xCentroLabel = xTabla + ((anchoTabla * 0.4) / 2);
            const xCentroLabel = xTabla + 0.2;
            const anchoLabel = this.calcularAnchoTexto(dato.label, config.alturaTexto);
            this.d.drawText(
                //xCentroLabel - (anchoLabel / 2),
                xCentroLabel,
                yCentroFila + 0.2,
                config.alturaTexto,
                0,
                dato.label
            );

            // Valor (derecha)
            const xCentroValor = xDivisionTabla + ((anchoTabla * 0.6) / 2);
            const anchoValor = this.calcularAnchoTexto(dato.valor, config.alturaTexto);
            this.d.drawText(
                xCentroValor - (anchoValor / 2) - 2,
                yCentroFila - (config.alturaTexto / 2) - 0.2,
                config.alturaTexto,
                0,
                dato.valor
            );
        });

        // ===== AGREGAR CONTENIDO DE LÁMINA =====

        // "Lamina :" en la parte superior
        const yLabelLamina = ySuperior - (altoTotal * 0.25);
        const xCentroLamina = xLamina + (anchoLamina / 2);
        const labelLamina = "Lamina :";
        const anchoLabelLamina = this.calcularAnchoTexto(labelLamina, config.alturaTexto);

        this.d.drawText(
            //xCentroLamina - (anchoLabelLamina / 2),
            xCentroLamina,
            yLabelLamina,
            config.alturaTexto,
            0,
            labelLamina
        );

        // "E-1" centrado y más grande
        const yCentroE1 = yInferior + (altoTotal * 0.4);
        const textoE1 = "E-1";
        const anchoE1 = this.calcularAnchoTexto(textoE1, config.alturaTextoLamina);

        this.d.drawText(
            xCentroLamina - (anchoE1 / 2),
            yCentroE1 - (config.alturaTextoLamina / 2),
            config.alturaTextoLamina,
            0,
            textoE1
        );
    }

    // ===== MÉTODO MEJORADO PARA RENDERIZAR TEXTO =====
    renderizarTextoMembrete(contenido, xIzquierda, xDerecha, yInferior, ySuperior, ancho, alto) {
        // Configuración de texto con tamaños aumentados
        const configuracionTexto = {
            'grande': {
                alturaSubtitle: 0.20,    // Aumentado de 0.16
                alturaDescripcion: 0.18, // Aumentado de 0.14
                estilo: 'ARIAL_GRANDE'
            },
            'mediano': {
                alturaSubtitle: 0.16,    // Aumentado de 0.13
                alturaDescripcion: 0.14, // Aumentado de 0.11
                estilo: 'ARIAL_MEDIANO'
            },
            'pequeño': {
                alturaSubtitle: 0.13,    // Aumentado de 0.11
                alturaDescripcion: 0.11, // Aumentado de 0.09
                estilo: 'ARIAL_PEQUENO'
            }
        };

        const config = configuracionTexto[contenido.tamaño] || configuracionTexto['mediano'];
        const espaciadoLinea = config.alturaDescripcion * 1.2;
        const espaciadoSeccion = config.alturaDescripcion * 1.8; // Espacio entre elementos

        let yActualTexto = ySuperior - 0.1; // comenzar desde arriba con margen

        contenido.textos.forEach((item, index) => {
            // ===== PROCESAR SUBTITLE =====
            let alturaSubtitle = 0;
            if (item.subtitle && item.subtitle.trim() !== '') {
                // Subtitle alineado a la izquierda
                this.d.drawText(
                    xIzquierda + 0.1,
                    yActualTexto,
                    config.alturaSubtitle,
                    0,
                    item.subtitle
                );
                alturaSubtitle = config.alturaSubtitle;
                yActualTexto -= espaciadoLinea; // Mover hacia abajo después del subtitle
            }

            // ===== PROCESAR DESCRIPCION CENTRADA =====
            if (item.descripcion && item.descripcion.trim() !== '') {
                const lineasDescripcion = this.dividirTextoEnLineas(item.descripcion, ancho * 0.8);
                const centroX = xIzquierda + (ancho / 2); // Centro del área disponible

                lineasDescripcion.forEach((linea, lineaIndex) => {
                    const anchoTextoLinea = this.calcularAnchoTexto(linea, config.alturaDescripcion);
                    const xCentrado = centroX - (anchoTextoLinea / 2);

                    this.d.drawText(
                        xCentrado,
                        yActualTexto,
                        config.alturaDescripcion,
                        0,
                        linea
                    );

                    yActualTexto -= espaciadoLinea;
                });
            }

            // Espacio adicional entre elementos (excepto el último)
            if (index < contenido.textos.length - 1) {
                yActualTexto -= espaciadoSeccion;
            }

            // Verificar si queda espacio
            if (yActualTexto < yInferior + 0.1) {
                console.warn(`Sección: No hay espacio suficiente para mostrar todo el contenido`);
                return;
            }
        });
    }

    // ===== MÉTODO MEJORADO PARA DIVIDIR TEXTO EN LÍNEAS =====
    dividirTextoEnLineas(texto, anchoMaximo) {
        const lineasExplicitas = texto.split('\n');
        const lineasFinales = [];

        lineasExplicitas.forEach(lineaExplicita => {
            if (lineaExplicita.trim() === '') {
                lineasFinales.push('');
                return;
            }

            const palabras = lineaExplicita.trim().split(' ');
            let lineaActual = '';

            palabras.forEach(palabra => {
                const lineaTemporal = lineaActual + (lineaActual ? ' ' : '') + palabra;

                if (this.calcularAnchoTexto(lineaTemporal, 0.11) <= anchoMaximo) {
                    lineaActual = lineaTemporal;
                } else {
                    if (lineaActual) {
                        lineasFinales.push(lineaActual);
                        lineaActual = palabra;
                    } else {
                        lineasFinales.push(palabra);
                        lineaActual = '';
                    }
                }
            });

            if (lineaActual) {
                lineasFinales.push(lineaActual);
            }
        });

        return lineasFinales;
    }

    // ===== MÉTODO MEJORADO PARA CALCULAR ANCHO DE TEXTO =====
    calcularAnchoTexto(texto, alturaTexto) {
        // Factor mejorado para estimación más precisa
        const factorAncho = 0.65; // Ajustado para mejor precisión
        return texto.length * alturaTexto * factorAncho;
    }
}

// ====================================
// 5. SISTEMA DE COTAS
// ====================================

class DimensionSystem {

    constructor(drawing) {
        this.d = drawing;
    }

    drawHorizontalDimension(x1, x2, y, offsetY, text, layer = 'COTAS') {
        // Tu función drawHorizontalDimension() va aquí
        const yDim = y + offsetY;
        const longitud = Math.abs(x2 - x1);

        // Asegurar que x1 < x2
        const startX = Math.min(x1, x2);
        const endX = Math.max(x1, x2);

        // Establecer capa
        this.d.setActiveLayer(layer);

        // Líneas de extensión (más largas para mejor visualización)
        const extensionLength = Math.abs(offsetY) + 0.1;
        this.d.drawLine(startX, y, startX, y + (offsetY > 0 ? extensionLength : -extensionLength));
        this.d.drawLine(endX, y, endX, y + (offsetY > 0 ? extensionLength : -extensionLength));

        // Línea de cota principal
        this.d.drawLine(startX, yDim, endX, yDim);

        // Flechas arquitectónicas (más grandes para mejor visualización)
        const arrowSize = 0.05;
        this.d.drawLine(startX, yDim, startX + arrowSize, yDim + arrowSize);
        this.d.drawLine(startX, yDim, startX + arrowSize, yDim - arrowSize);
        this.d.drawLine(endX, yDim, endX - arrowSize, yDim + arrowSize);
        this.d.drawLine(endX, yDim, endX - arrowSize, yDim - arrowSize);

        // text de cota centrado
        const xText = ((startX + endX) / 2) - 0.1;
        const textHeight = 0.1;
        this.d.drawText(xText, yDim + (offsetY > 0 ? 0.2 : -0.4), textHeight, 0, text);
    }

    drawVerticalDimension(x, y1, y2, offsetX, text, layer = 'COTAS') {
        // Tu función drawVerticalDimension() va aquí
        const xDim = x + offsetX;

        // Asegurar que y1 < y2
        const startY = Math.min(y1, y2);
        const endY = Math.max(y1, y2);

        // Establecer capa
        this.d.setActiveLayer(layer);

        // Líneas de extensión
        const extensionLength = Math.abs(offsetX) + 0.1;
        this.d.drawLine(x, startY, x + (offsetX > 0 ? extensionLength : -extensionLength), startY);
        this.d.drawLine(x, endY, x + (offsetX > 0 ? extensionLength : -extensionLength), endY);

        // Línea de cota principal
        this.d.drawLine(xDim, startY, xDim, endY);

        // Flechas
        const arrowSize = 0.05;
        this.d.drawLine(xDim, startY, xDim + arrowSize, startY + arrowSize);
        this.d.drawLine(xDim, startY, xDim - arrowSize, startY + arrowSize);
        this.d.drawLine(xDim, endY, xDim + arrowSize, endY - arrowSize);
        this.d.drawLine(xDim, endY, xDim - arrowSize, endY - arrowSize);

        // text rotado
        const yText = ((startY + endY) / 2) - 0.1;
        const textHeight = 0.1;
        this.d.drawText(xDim + (offsetX > 0 ? 0.2 : -0.4), yText, textHeight, 90, text);
    }

    addProfessionalDimensions(displacedPoints, params, wallType) {
        // Tu función agregarCotasProfesionales() va aquí
        if (!params) {
            console.error('❌ No se recibieron parámetros para las cotas');
            return;
        }

        // Capa específica para cotas
        const layerCotas = `COTAS_${wallType}`;
        this.d.addLayer(layerCotas, Drawing.ACI.WHITE, 'CONTINUOUS');
        this.d.setActiveLayer(layerCotas);

        // Obtener coordenadas extremas de los puntos desplazados
        const minX = Math.min(...displacedPoints.map(p => p.x));
        const maxX = Math.max(...displacedPoints.map(p => p.x));
        const minY = Math.min(...displacedPoints.map(p => p.y));
        const maxY = Math.max(...displacedPoints.map(p => p.y));

        // Calcular posiciones clave basadas en los puntos reales
        const baseTotal = maxX - minX;
        const alturaTotal = maxY - minY;
        const alturaZapata = params.alturaZapata;
        const yZapata = minY + alturaZapata;

        // Encontrar las posiciones del vástago en los puntos desplazados
        const vastago = displacedPoints.find(p => p.y === maxY); // Punto más alto
        const xVastagoDerechobase = displacedPoints[3].x; // P4
        const xVastagoDerecho = displacedPoints[4].x; // P5
        const xVastagoIzquierdo = displacedPoints[5].x; // P6
        const xVastagoIzquierdo2 = displacedPoints[6].x; // P6
        const anchoVastago = xVastagoDerecho - xVastagoIzquierdo;

        // === COTAS HORIZONTALES INFERIORES ===

        // 1. Cota total de la base (nivel más bajo)
        this.drawHorizontalDimension(minX, maxX, minY, -0.8,
            `${baseTotal.toFixed(2)}`, layerCotas);

        // 2. Cota del Punta (segmento izquierdo - punta)
        const punta = xVastagoIzquierdo - minX;
        if (punta > 0.1) {
            this.drawHorizontalDimension(minX, xVastagoIzquierdo2, minY, -0.3,
                `${punta.toFixed(2)}`, layerCotas);
        }

        // 3. Cota del talon (segmento derecho - Talon)
        const talon = maxX - xVastagoDerecho;
        if (talon > 0.1) {
            this.drawHorizontalDimension(xVastagoDerecho, maxX, minY, -0.3,
                `${talon.toFixed(2)}`, layerCotas);
        }

        // 4. Cota de la base de la pantalla (segmento centrado)
        const basePantalla = xVastagoDerechobase - xVastagoIzquierdo2;
        if (basePantalla > 0.1) {
            this.drawHorizontalDimension(xVastagoIzquierdo2, xVastagoDerechobase, minY, -0.3,
                `${basePantalla.toFixed(2)}`, layerCotas);
        }

        // 5. Cota del ancho de la corona (ancho de corona)
        this.drawHorizontalDimension(xVastagoIzquierdo, xVastagoDerecho, maxY, 0.3,
            `${anchoVastago.toFixed(2)}`, layerCotas);

        // === COTAS VERTICALES ===
        // 1. Altura total del muro (lado derecho)
        this.drawVerticalDimension(maxX, minY, maxY, 0.8,
            `${alturaTotal.toFixed(2)}`, layerCotas);

        // 2. Altura del vástago (desde zapata hasta corona)
        const alturaVastago = maxY - yZapata;
        this.drawVerticalDimension(maxX, yZapata, maxY, 0.3,
            `${alturaVastago.toFixed(2)}`, layerCotas);

        // 3. Altura de la zapata (lado izquierdo)
        if (alturaZapata > 0.1) {
            // Se dibuja en la misma línea que la altura del vástago para que se vean como componentes de la altura total.
            this.drawVerticalDimension(maxX, minY, yZapata, 0.3,
                `${alturaZapata.toFixed(2)}`, layerCotas);
        }
    }

    addDrainageDimensions(displacedPoints, displacedSoil, params, wallType) {
        // Tu función agregarCotasProfesionalesDRENAJE() va aquí
        if (!params) {
            console.error('❌ No se recibieron parámetros para las cotas');
            return;
        }

        // Capa específica para cotas
        const layerCotas = `COTAS_${wallType}`;
        this.d.addLayer(layerCotas, Drawing.ACI.WHITE, 'CONTINUOUS');
        this.d.setActiveLayer(layerCotas);

        // Obtener coordenadas extremas de los puntos desplazados
        const minX = Math.min(...displacedPoints.map(p => p.x));
        const maxX = Math.max(...displacedPoints.map(p => p.x));
        const minY = Math.min(...displacedPoints.map(p => p.y));
        const maxY = Math.max(...displacedPoints.map(p => p.y));

        // Calcular posiciones clave basadas en los puntos reales
        const baseTotal = maxX - minX;
        const alturaTotal = maxY - minY;
        const alturaZapata = params.alturaZapata;
        const yZapata = minY + alturaZapata;

        // Encontrar las posiciones del vástago en los puntos desplazados
        const vastago = displacedPoints.find(p => p.y === maxY); // Punto más alto
        const xVastagoDerechobase = displacedPoints[3].x; // P4
        const xVastagoDerecho = displacedPoints[4].x; // P5
        const xVastagoIzquierdo = displacedPoints[5].x; // P6
        const xVastagoIzquierdo2 = displacedPoints[6].x; // P6
        const anchoVastago = xVastagoDerecho - xVastagoIzquierdo;

        // === COTAS HORIZONTALES INFERIORES ===

        // 1. Cota total de la base (nivel más bajo)
        this.drawHorizontalDimension(minX, maxX, minY, -0.8,
            `${baseTotal.toFixed(2)}`, layerCotas);

        // 2. Cota del Punta (segmento izquierdo - punta)
        const punta = xVastagoIzquierdo - minX;
        if (punta > 0.1) {
            this.drawHorizontalDimension(minX, xVastagoIzquierdo2, minY, -0.3,
                `${punta.toFixed(2)}`, layerCotas);
        }

        // 3. Cota del talon (segmento derecho - Talon)
        const talon = maxX - xVastagoDerecho;
        if (talon > 0.1) {
            this.drawHorizontalDimension(xVastagoDerecho, maxX, minY, -0.3,
                `${talon.toFixed(2)}`, layerCotas);
        }

        // 4. Cota de la base de la pantalla (segmento centrado)
        const basePantalla = xVastagoDerechobase - xVastagoIzquierdo2;
        if (basePantalla > 0.1) {
            this.drawHorizontalDimension(xVastagoIzquierdo2, xVastagoDerechobase, minY, -0.3,
                `${basePantalla.toFixed(2)}`, layerCotas);
        }

        // === COTAS VERTICALES ===
        // 1. Altura total del muro (lado derecho)
        this.drawVerticalDimension(maxX, minY, maxY, 0.8,
            `${alturaTotal.toFixed(2)}`, layerCotas);

        // 2. Altura de la zapata (lado izquierdo)
        if (alturaZapata > 0.1) {
            // Se dibuja en la misma línea que la altura del vástago para que se vean como componentes de la altura total.
            this.drawVerticalDimension(minX, minY, yZapata, -0.3,
                `${alturaZapata.toFixed(2)}`, layerCotas);
        }

        // // 3. Altura del vástago (desde zapata hasta corona)
        // const alturaVastago = maxY - yZapata;
        // drawVerticalDimension(d, minX, yZapata, maxY, -0.3,
        //     `${alturaVastago.toFixed(2)}m`, layerCotas);

        // 4. Altura desde base hasta línea del suelo (suelo delante)
        const ySuelo = displacedSoil[0].y; // Ambos SD1 y SD2 tienen la misma Y
        const alturaSuelo = ySuelo - yZapata;

        if (alturaSuelo > 0.1) {
            this.drawVerticalDimension(minX, yZapata, ySuelo, -0.3,
                `${alturaSuelo.toFixed(2)}`, layerCotas);
        }

        // 5. División del tramo entre suelo y corona en partes de 1 metro
        const alturaSuperior = maxY - ySuelo;
        const paso = 1.0;
        const cantidadDivisiones = Math.floor(alturaSuperior / paso);

        for (let i = 0; i < cantidadDivisiones; i++) {
            const yInicio = ySuelo + i * paso;
            const yFin = ySuelo + (i + 1) * paso;

            this.drawVerticalDimension(minX, yInicio, yFin, -0.3,
                `${paso.toFixed(2)}`, layerCotas);
        }

        // Si sobra un tramo menor a 1m
        const resto = alturaSuperior - cantidadDivisiones * paso;
        if (resto > 0.1) {
            const yInicio = ySuelo + cantidadDivisiones * paso;
            this.drawVerticalDimension(minX, yInicio, maxY, -0.3,
                `${resto.toFixed(2)}`, layerCotas);
        }

    }

    addDimensionsFaces(offsetX, offsetY, params, faceType) {
        const layerCotas = `COTAS_${faceType}`;
        this.d.addLayer(layerCotas, Drawing.ACI.WHITE, 'CONTINUOUS');
        this.d.setActiveLayer(layerCotas);

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
            d.drawMLeader(puntosHoriz, `${params.anchoTotal.toFixed(2)}`);
        } catch (e) {
            // Fallback a línea de cota tradicional
            this.drawHorizontalDimension(xMin, xMax, yMin, -0.2, `${params.anchoTotal.toFixed(2)}`, layerCotas);
        }

        // MLeader para dimensión vertical total
        try {
            const puntosVert = [
                { x: xMax + 0.15, y: yMin },
                { x: xMax + 0.4, y: (yMin + yMax) / 2 }
            ];
            d.drawMLeader(puntosVert, `${params.altoTotal.toFixed(2)}`);
        } catch (e) {
            // Fallback a línea de cota tradicional
            this.drawVerticalDimension(xMax, yMin, yMax, +0.2, `${params.altoTotal.toFixed(2)}`, layerCotas);
        }

        // MLeader para espaciado del acero
        // try {
        //     const puntosEspaciado = [
        //         { x: xMin, y: yMax + 0.15 },
        //         { x: xMin + 0.5, y: yMax + 0.4 }
        //     ];
        //     this.d.drawMLeader(puntosEspaciado, textoAcero);
        // } catch (e) {
        //     // Fallback a línea de cota tradicional
        //     this.drawHorizontalDimension(xMin, xMin + params.espaciadoGrid, yMax, 0.3, textoAcero, layerCotas);
        // }
    }
}

// ====================================
// 6. SISTEMA DE ANOTACIONES Y LEADERS
// ====================================

class AnnotationSystem {

    constructor(drawing) {
        this.d = drawing;
    }

    drawLeader(startX, startY, endX, endY, text, layer = 'LEADERS') {
        // Tu función drawLeader() va aquí
        // Establecer capa
        this.d.setActiveLayer(layer);

        // Línea principal del leader
        this.d.drawLine(startX, startY, endX, endY);

        // Flecha al final (punto de acero)
        const arrowSize = 0.05;
        const angle = Math.atan2(startY - endY, startX - endX);

        // Dibujar flecha
        this.d.drawLine(startX, startY,
            startX - arrowSize * Math.cos(angle - 0.3),
            startY - arrowSize * Math.sin(angle - 0.3));
        this.d.drawLine(startX, startY,
            startX - arrowSize * Math.cos(angle + 0.3),
            startY - arrowSize * Math.sin(angle + 0.3));

        // Línea horizontal corta para el texto
        const lineLength = 0.3;
        const textStartX = endX;
        const textEndX = endX + lineLength;
        this.d.drawLine(textStartX, endY, textEndX, endY);

        // Texto del leader
        const textHeight = 0.08;
        this.d.drawText(textEndX + 0.05, endY + 0.02, textHeight, 0, text);
    }

    drawMultiLeaderWithExtension(startX, startY, endX, endY, text, layer, direction) {
        // Tu función drawMultiLeaderWithExtension() va aquí
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
        this.d.drawLine(startX, startY, extensionStartX, extensionStartY, layer);

        // Dibujar línea principal del leader
        this.d.drawLine(extensionStartX, extensionStartY, extensionEndX, extensionEndY, layer);

        // Agregar texto
        const textX = endX + (direction === 'right' ? 0.1 : direction === 'left' ? -0.5 : 0);
        const textY = endY + 0.05;

        this.d.drawText(textX, textY, 0.12, 0, text, layer);
    }

    addSteelLeaderDimensions(steels, offsetX = 0, offsetY = 0, concretoArmadoData) {
        // Tu función agregarCotasLeaderAceros() va aquí
        // Crear capa para leaders
        this.d.addLayer('ACERO_LEADERS', Drawing.ACI.WHITE, 'CONTINUOUS');
        this.d.setActiveLayer('ACERO_LEADERS');

        const grupos = ['rectangle', 'triangle'];

        // Buscar configuración de acero de la pantalla
        const pantallaConfig = concretoArmadoData.find(cfg => cfg.tipo === 'pantalla');
        const puntaConfig = concretoArmadoData.find(cfg => cfg.tipo === 'punta');
        const talonConfig = concretoArmadoData.find(cfg => cfg.tipo === 'talon');
        const keyConfig = concretoArmadoData.find(cfg => cfg.tipo === 'key');

        // Función para obtener datos de un tipo de acero específico
        function obtenerAcero(config, tipoAceroBuscado) {
            if (!config) return null;
            return config.aceros.find(a => a.tipoAcero === tipoAceroBuscado);
        }

        grupos.forEach(grupo => {
            if (!steels[grupo] || steels[grupo].length === 0) {
                console.warn(`⚠️ No hay aceros en el grupo: ${grupo}`);
                return;
            }

            // Agrupar aceros por zona
            const acerosAgrupadosPorZona = {};
            steels[grupo].forEach(acero => {
                if (!acerosAgrupadosPorZona[acero.zona]) {
                    acerosAgrupadosPorZona[acero.zona] = [];
                }
                acerosAgrupadosPorZona[acero.zona].push(acero);
            });

            // Crear un leader para cada zona (apuntando al primer acero de cada zona)
            Object.keys(acerosAgrupadosPorZona).forEach(zona => {
                const acerosZona = acerosAgrupadosPorZona[zona];
                if (!acerosZona.length) return;

                const primerAcero = acerosZona[0];
                const ultimoAcero = acerosZona[acerosZona.length - 1];
                // Calcular espaciado
                let espaciado = 0;
                if (acerosZona.length > 1) {
                    const dx = acerosZona[1].x - acerosZona[0].x;
                    const dy = acerosZona[1].y - acerosZona[0].y;
                    espaciado = Math.sqrt(dx * dx + dy * dy);
                }
                let espaciadoCm = Math.round(espaciado * 100);

                // Texto leader
                let textoLeader = '';
                switch (zona) {
                    case "rectangulo_superior":
                        //const aceroSecundario = obtenerAcero(pantallaConfig, 'secundario');
                        const acerotransversalpunta = obtenerAcero(puntaConfig, 'transversal');
                        if (acerotransversalpunta) {
                            textoLeader = `${acerotransversalpunta.cantidad}∅${acerotransversalpunta.diametro}"@${acerotransversalpunta.espaciamiento}cm`;
                        } else {
                            textoLeader = `?∅?@?cm`; // Fallback si no existe
                        }
                        //textoLeader = `1∅3/8"@${espaciadoCm || 17}cm`;
                        break;
                    case "rectangulo_inferior":
                        const aceroTransversal2punta = obtenerAcero(puntaConfig, 'transversal2');
                        if (aceroTransversal2punta) {
                            textoLeader = `${aceroTransversal2punta.cantidad}∅${aceroTransversal2punta.diametro}"@${aceroTransversal2punta.espaciamiento}cm`;
                        } else {
                            textoLeader = `?∅?@?cm`; // Fallback si no existe
                        }
                        //textoLeader = `1∅1/2"@${espaciadoCm || 20}cm`;
                        break;
                    case "triangulo_izquierdo":
                        const aceroTransversal2pantalla = obtenerAcero(pantallaConfig, 'transversal2');
                        if (aceroTransversal2pantalla) {
                            textoLeader = `${aceroTransversal2pantalla.cantidad}∅${aceroTransversal2pantalla.diametro}"@${aceroTransversal2pantalla.espaciamiento}cm`;
                        } else {
                            textoLeader = `?∅?@?cm`; // Fallback si no existe
                        }
                        //textoLeader = `1∅1/2"@${espaciadoCm || 20}cm`;
                        break;
                    case "triangulo_derecho":
                        const aceroTransversalpantalla = obtenerAcero(pantallaConfig, 'transversal');
                        if (aceroTransversalpantalla) {
                            textoLeader = `${aceroTransversalpantalla.cantidad}∅${aceroTransversalpantalla.diametro}"@${aceroTransversalpantalla.espaciamiento}cm`;
                        } else {
                            textoLeader = `?∅?@?cm`; // Fallback si no existe
                        }
                        //textoLeader = `1∅3/8"@${espaciadoCm || 20}cm`;
                        break;
                }

                // Coordenadas del leader
                let deltaX = 0, deltaY = 0, leaderEndX, leaderEndY;

                switch (zona) {
                    case "rectangulo_superior":
                        deltaY = -0.05;
                        leaderEndX = ultimoAcero.x + offsetX;
                        leaderEndY = ultimoAcero.y + offsetY + deltaY + 0.3;
                        break;
                    case "rectangulo_inferior":
                        deltaY = +0.04;
                        leaderEndX = primerAcero.x + offsetX;
                        leaderEndY = primerAcero.y + offsetY + deltaY + 1;
                        break;
                    case "triangulo_izquierdo":
                        deltaX = +0.05;
                        leaderEndX = ultimoAcero.x + offsetX + deltaX - 2.0;
                        leaderEndY = ultimoAcero.y + offsetY + 0.3;
                        break;
                    case "triangulo_derecho":
                        deltaX = -0.05;
                        leaderEndX = primerAcero.x + offsetX + deltaX + 1.0;
                        leaderEndY = primerAcero.y + offsetY + 0.3;
                        break;
                }

                // Dibujar leader
                this.drawLeader(
                    (zona === "rectangulo_superior" || zona === "triangulo_izquierdo"
                        ? ultimoAcero.x
                        : primerAcero.x) + offsetX + deltaX,
                    (zona === "rectangulo_superior" || zona === "triangulo_izquierdo"
                        ? ultimoAcero.y
                        : primerAcero.y) + offsetY + deltaY,
                    leaderEndX,
                    leaderEndY,
                    textoLeader,
                    'ACERO_LEADERS'
                );

            });
        });
    }

    addInternalStructureLeaders(contours, offsetX = 0, offsetY = 0, concretoArmadoData) {
        // Crear capa para leaders de estructura
        this.d.addLayer('ESTRUCTURA_LEADERS', Drawing.ACI.WHITE, 'CONTINUOUS');
        this.d.setActiveLayer('ESTRUCTURA_LEADERS');

        const { triangleStalk, rectangleBase } = contours;

        // Buscar configuración de acero de la pantalla
        const pantallaConfig = concretoArmadoData.find(cfg => cfg.tipo === 'pantalla');
        const puntaConfig = concretoArmadoData.find(cfg => cfg.tipo === 'punta');
        const talonConfig = concretoArmadoData.find(cfg => cfg.tipo === 'talon');
        const keyConfig = concretoArmadoData.find(cfg => cfg.tipo === 'key');

        // Función para obtener datos de un tipo de acero específico
        function obtenerAcero(config, tipoAceroBuscado) {
            if (!config) return null;
            return config.aceros.find(a => a.tipoAcero === tipoAceroBuscado);
        }

        // Verificar que existan los contornos
        if (!rectangleBase || !triangleStalk) {
            console.warn('⚠️ No se encontraron contornos de estructura');
            return;
        }

        // Aplicar offsets a los puntos
        const rectPoints = rectangleBase.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }));
        const triPoints = triangleStalk.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }));

        // ===== 1. LEADER PARA ANCHO SUPERIOR DEL RECTÁNGULO =====
        const puntoMedioSuperior = {
            x: (rectPoints[2].x + rectPoints[3].x) / 2,
            y: rectPoints[2].y
        };

        const acerotransversalpunta = obtenerAcero(talonConfig, 'transversal');
        let aceroanchosuperior = "";
        if (acerotransversalpunta) {
            aceroanchosuperior = `${acerotransversalpunta.cantidad}∅${acerotransversalpunta.diametro}"@${acerotransversalpunta.espaciamiento}cm`;
        } else {
            aceroanchosuperior = `?∅?@?cm`; // Fallback si no existe
        }
        this.drawLeader(
            puntoMedioSuperior.x,
            puntoMedioSuperior.y,
            puntoMedioSuperior.x + 0.8,
            puntoMedioSuperior.y + 0.6,
            aceroanchosuperior,
            'ESTRUCTURA_LEADERS'
        );

        // ===== 2. LEADER PARA ANCHO INFERIOR DEL RECTÁNGULO =====
        const puntoMedioInferior = {
            x: (rectPoints[0].x + rectPoints[1].x) / 2,
            y: rectPoints[0].y
        };

        const acerotransversal2punta = obtenerAcero(talonConfig, 'transversal2');
        let aceroanchoinferior = "";
        if (acerotransversal2punta) {
            aceroanchoinferior = `${acerotransversal2punta.cantidad}∅${acerotransversal2punta.diametro}"@${acerotransversal2punta.espaciamiento}cm`;
        } else {
            aceroanchoinferior = `?∅?@?cm`; // Fallback si no existe
        }

        this.drawLeader(
            puntoMedioInferior.x,
            puntoMedioInferior.y,
            puntoMedioInferior.x + 0.8,
            puntoMedioInferior.y + 1,
            aceroanchoinferior,
            'ESTRUCTURA_LEADERS'
        );

        // ===== 3. LEADER PARA LADO IZQUIERDO DEL TRIÁNGULO =====
        const puntoMedioIzquierdo = {
            x: triPoints[0].x + 0.25,
            y: (triPoints[0].y + triPoints[3].y) / 2
        };

        const acerosecpantalla = obtenerAcero(talonConfig, 'secundario');
        let aceroladoizquierdo = "";
        if (acerosecpantalla) {
            aceroladoizquierdo = `${acerosecpantalla.cantidad}∅${acerosecpantalla.diametro}"@${acerosecpantalla.espaciamiento}cm`;
        } else {
            aceroladoizquierdo = `?∅?@?cm`; // Fallback si no existe
        }

        this.drawLeader(
            puntoMedioIzquierdo.x,
            puntoMedioIzquierdo.y,
            puntoMedioIzquierdo.x - 1.5,
            puntoMedioIzquierdo.y + 0.3,
            aceroladoizquierdo,
            'ESTRUCTURA_LEADERS'
        );

        // ===== 4. LEADER PARA LADO DERECHO DEL TRIÁNGULO =====
        const puntoMedioDerecho = {
            x: triPoints[1].x,
            y: (triPoints[1].y + triPoints[2].y) / 2
        };

        const acerosprinpantalla = obtenerAcero(talonConfig, 'secundario');
        let aceroladoderecho = "";
        if (acerosprinpantalla) {
            aceroladoderecho = `${acerosprinpantalla.cantidad}∅${acerosprinpantalla.diametro}"@${acerosprinpantalla.espaciamiento}cm`;
        } else {
            aceroladoderecho = `?∅?@?cm`; // Fallback si no existe
        }

        this.drawLeader(
            puntoMedioDerecho.x,
            puntoMedioDerecho.y,
            puntoMedioDerecho.x + 1.5,
            puntoMedioDerecho.y + 0.3,
            aceroladoderecho,
            'ESTRUCTURA_LEADERS'
        );

        // ===== 5. LEADER PARA ALTURA TOTAL DE LA ESTRUCTURA =====
        const todosPuntos = [...rectPoints, ...triPoints];
        const yMinimo = Math.min(...todosPuntos.map(p => p.y));
        const yMaximo = Math.max(...todosPuntos.map(p => p.y));
        const xMinimo = Math.min(...todosPuntos.map(p => p.x));

        const puntoAlturaTotal = {
            x: xMinimo,
            y: (yMinimo + yMaximo) / 2
        };
    }

    addSteelLeaderMesh(offsetX, offsetY, params, faceType, concretoArmadoData) {
        // Crear capa para leaders de malla de acero
        const layerLeaders = `MESH_LEADERS_${faceType}`;
        this.d.addLayer(layerLeaders, Drawing.ACI.WHITE, 'CONTINUOUS');
        this.d.setActiveLayer(layerLeaders);

        // Verificar que existan los parámetros necesarios
        if (!params || !params.acero) {
            console.warn(`⚠️ No se encontraron parámetros de malla para: ${faceType}`);
            return;
        }

        const config = params.configuracion;
        const configAcero = params.acero;

        const pantallaConfig = concretoArmadoData.find(cfg => cfg.tipo === 'pantalla');
        const puntaConfig = concretoArmadoData.find(cfg => cfg.tipo === 'punta');
        const talonConfig = concretoArmadoData.find(cfg => cfg.tipo === 'talon');
        const keyConfig = concretoArmadoData.find(cfg => cfg.tipo === 'key');

        // Función para obtener datos de un tipo de acero específico
        function obtenerAcero(config, tipoAceroBuscado) {
            if (!config) return null;
            return config.aceros.find(a => a.tipoAcero === tipoAceroBuscado);
        }

        //=== aceros verticalmente izquierda
        const aceroTransversal2pantalla = obtenerAcero(pantallaConfig, 'transversal2');
        let aceroizquierdo = "";
        if (aceroTransversal2pantalla) {
            aceroizquierdo = `${aceroTransversal2pantalla.cantidad}∅${aceroTransversal2pantalla.diametro}"@${aceroTransversal2pantalla.espaciamiento}cm`;
        } else {
            aceroizquierdo = `?∅?@?cm`; // Fallback si no existe
        }

        //=== aceros Horizontal izquierda
        const acerosecpantalla = obtenerAcero(talonConfig, 'secundario');
        let aceroladoizquierdo = "";
        if (acerosecpantalla) {
            aceroladoizquierdo = `${acerosecpantalla.cantidad}∅${acerosecpantalla.diametro}"@${acerosecpantalla.espaciamiento}cm`;
        } else {
            aceroladoizquierdo = `?∅?@?cm`; // Fallback si no existe
        }


        //=== aceros verticalmente derecha
        const aceroTransversalpantalla = obtenerAcero(pantallaConfig, 'transversal');
        let aceroladoderecho = "";
        if (aceroTransversalpantalla) {
            aceroladoderecho = `${aceroTransversalpantalla.cantidad}∅${aceroTransversalpantalla.diametro}"@${aceroTransversalpantalla.espaciamiento}cm`;
        } else {
            aceroladoderecho = `?∅?@?cm`; // Fallback si no existe
        }

        //=== aceros Horizontal derecha
        const acerosprinpantalla = obtenerAcero(talonConfig, 'secundario');
        let aceroladoderechoaa = "";
        if (acerosprinpantalla) {
            aceroladoderechoaa = `${acerosprinpantalla.cantidad}∅${acerosprinpantalla.diametro}"@${acerosprinpantalla.espaciamiento}cm`;
        } else {
            aceroladoderechoaa = `?∅?@?cm`; // Fallback si no existe
        }


        // === rectangulo superior acero 
        const acerotransversalpunta = obtenerAcero(puntaConfig, 'transversal');
        let acerorecsup = "";
        if (acerotransversalpunta) {
            acerorecsup = `${acerotransversalpunta.cantidad}∅${acerotransversalpunta.diametro}"@${acerotransversalpunta.espaciamiento}cm`;
        } else {
            acerorecsup = `?∅?@?cm`; // Fallback si no existe
        }

        //  === Acero exterior del acero
        let aceroanchosuperior = "";
        if (acerotransversalpunta) {
            aceroanchosuperior = `${acerotransversalpunta.cantidad}∅${acerotransversalpunta.diametro}"@${acerotransversalpunta.espaciamiento}cm`;
        } else {
            aceroanchosuperior = `?∅?@?cm`; // Fallback si no existe
        }

        // Calcular límites de la malla
        const xMin = params.xMin + offsetX;
        const xMax = params.xMax + offsetX;
        const yMin = params.yMin + offsetY;
        const yMax = params.yMax + offsetY;

        // Calcular espaciado en centímetros
        const espaciadoCm = params.espaciadoGrid * 100;
        const textoAcero = `${configAcero.cantidad}∅${configAcero.diametro}"@${espaciadoCm.toFixed(0)}cm`;

        // ===== 1. LEADER PARA ACERO HORIZONTAL =====
        // Punto en una línea horizontal (primera línea horizontal de la malla)
        const puntoAceroHorizontal = {
            x: xMin + (params.espaciadoGrid * 2), // Segundo punto de la malla horizontal
            y: yMin + params.espaciadoGrid // Primera línea horizontal
        };

        // Determinar textos según faceType
        let textoHorizontal = "";
        let textoVertical = "";

        switch (faceType) {
            case 'INTERIOR':
                textoVertical = aceroizquierdo;
                textoHorizontal = aceroladoizquierdo;
                break;
            case 'EXTERIOR':
                textoVertical = aceroladoderecho;
                textoHorizontal = aceroladoderechoaa;
                break;
            case 'INFERIOR':
            case 'SUPERIOR':
                textoVertical = acerorecsup;
                textoHorizontal = aceroanchosuperior;
                break;
            default:
                textoVertical = textoAcero + "v";
                textoHorizontal = textoAcero;
        }

        // Posicionar leader según el tipo de cara para evitar solapamientos
        let leaderHorizX, leaderHorizY;
        switch (faceType) {
            case 'INTERIOR':
                leaderHorizX = puntoAceroHorizontal.x - 2;
                leaderHorizY = puntoAceroHorizontal.y + 0.5;
                break;
            case 'EXTERIOR':
                leaderHorizX = puntoAceroHorizontal.x - 2;
                leaderHorizY = puntoAceroHorizontal.y + 0.5;
                break;
            case 'SUPERIOR':
                leaderHorizX = puntoAceroHorizontal.x - 2;
                leaderHorizY = puntoAceroHorizontal.y + 0.5
                break;
            case 'INFERIOR':
                leaderHorizX = puntoAceroHorizontal.x - 2;
                leaderHorizY = puntoAceroHorizontal.y + 0.5;
                break;
            default:
                leaderHorizX = puntoAceroHorizontal.x + 1.0;
                leaderHorizY = puntoAceroHorizontal.y + 0.8;
        }
        this.drawLeader(
            puntoAceroHorizontal.x + 0.09,
            puntoAceroHorizontal.y,
            leaderHorizX,
            leaderHorizY,
            `${textoHorizontal}`,
            layerLeaders
        );
        // this.drawLeader(
        //     puntoAceroHorizontal.x + 0.09,
        //     puntoAceroHorizontal.y,
        //     leaderHorizX,
        //     leaderHorizY,
        //     `${textoAcero}`, // Horizontal
        //     layerLeaders
        // );

        // ===== 2. LEADER PARA ACERO VERTICAL =====
        // Punto en una línea vertical (primera línea vertical de la malla)
        const puntoAceroVertical = {
            x: xMin + params.espaciadoGrid, // Primera línea vertical
            y: yMin + (params.espaciadoGrid * 2) // Segundo punto de la malla vertical
        };

        // Posicionar leader según el tipo de cara para evitar solapamientos
        let leaderVertX, leaderVertY;
        switch (faceType) {
            case 'INTERIOR':
                leaderVertX = puntoAceroVertical.x - 2;
                leaderVertY = puntoAceroVertical.y + 3;
                break;
            case 'EXTERIOR':
                leaderVertX = puntoAceroVertical.x - 2
                leaderVertY = puntoAceroVertical.y + 3;
                break;
            case 'SUPERIOR':
                leaderVertX = puntoAceroVertical.x - 2;
                leaderVertY = puntoAceroVertical.y + 3;
                break;
            case 'INFERIOR':
                leaderVertX = puntoAceroVertical.x - 2;
                leaderVertY = puntoAceroVertical.y + 3;
                break;
            default:
                leaderVertX = puntoAceroVertical.x - 1.2;
                leaderVertY = puntoAceroVertical.y + 0.5;
        }

        this.drawLeader(
            puntoAceroVertical.x,
            puntoAceroVertical.y + 2.09,
            leaderVertX,
            leaderVertY,
            `${textoVertical}`,
            layerLeaders
        );
        // this.drawLeader(
        //     puntoAceroVertical.x,
        //     puntoAceroVertical.y + 2.09,
        //     leaderVertX,
        //     leaderVertY,
        //     `${textoAcero}v`, // Vertical
        //     layerLeaders
        // );
    }

    addProfessionalTitle(x, y, wallType, scale = '1:50', predim) {
        // Tu función agregarTituloProfesional() va aquí
        // Capa para títulos
        this.d.addLayer(`TITULO_${wallType}`, Drawing.ACI.WHITE, 'CONTINUOUS');
        this.d.setActiveLayer(`TITULO_${wallType}`);

        // --- LÓGICA DE TÍTULOS MEJORADA ---
        let numero, titulo;
        switch (wallType) {
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
        this.d.drawCircle(x + 0.5, y + ((16 + predim.inputValues.B18) / 2) + 5, radio);

        //d.drawText(x - 1.0, y + 5.0, 0.15, 0, numero);
        this.d.drawText(x + 0.5, y + ((16 + predim.inputValues.B18) / 2) + 5, 0.15, 0, numero);

        //d.drawText(x - 0.4, y + 5.0, 0.12, 0, titulo);
        this.d.drawText(x + 1, y + ((16 + predim.inputValues.B18) / 2) + 5, 0.12, 0, titulo);

        // Escala
        //d.drawText(x - 0.4, y + 5.4, 0.1, 0, `ESC. ${escala}`);
        this.d.drawText(x + 1, y + ((16 + predim.inputValues.B18) / 2) + 4.8, 0.1, 0, `ESC. ${scale}`);
    }

    addTitleMallas(offsetX, offsetY, params, tipoCara) {
        const layerInfo = `INFO_${tipoCara}`;
        this.d.addLayer(layerInfo, Drawing.ACI.WHITE, 'CONTINUOUS');
        this.d.setActiveLayer(layerInfo);

        const config = params.configuracion;
        const tituloY = offsetY + (tipoCara === 'INTERIOR' || tipoCara === 'EXTERIOR' || tipoCara === 'INFERIOR' || tipoCara === 'SUPERIOR' ? 1.0 : 1.0);

        // Título principal
        this.d.drawText(offsetX + 1, tituloY, 0.15, 0, config.descripcion);

        // Escala
        this.d.drawText(offsetX + 1, tituloY - 0.3, 0.10, 0, 'ESC. 1:50');

        // Círculo de referencia con número
        const radioCirculo = 0.3;
        const xCirculo = offsetX + 0.5;
        const yCirculo = tituloY;

        this.d.drawCircle(xCirculo, yCirculo, radioCirculo);

        // Número de referencia según el tipo
        const numeroRef = { 'INTERIOR': '4', 'EXTERIOR': '5', 'INFERIOR': '6', 'SUPERIOR': '7' };
        this.d.drawText(xCirculo, yCirculo, 0.12, 0, numeroRef[tipoCara] || '4');
    }
}

// ====================================
// 7. RENDERIZADORES ESPECIALIZADOS
// ====================================

class WallRenderer {

    constructor(drawing, drawingSystem, dimensionSystem, annotationSystem) {
        this.d = drawing;
        this.drawingSystem = drawingSystem;
        this.dimensionSystem = dimensionSystem;
        this.annotationSystem = annotationSystem;
    }

    drawPolyline(points) {
        if (!points || points.length < 2) return;

        for (let i = 0; i < points.length - 1; i++) {
            if (points[i] && points[i + 1]) {
                this.d.drawLine(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
            }
        }
    }

    renderCompleteWall(wallPoints, offsetX, offsetY, wallType, predim, altoPlano) {
        if (!wallPoints || wallPoints.length === 0) {
            console.error(`❌ No hay puntos para dibujar el muro ${wallType}`);
            return [];
        }

        // Crear capa para el muro
        this.d.addLayer(`MURO_${wallType}`, Drawing.ACI.BLUE, 'CONTINUOUS');
        this.d.setActiveLayer(`MURO_${wallType}`);

        // Desplazar puntos
        const puntosDesplazados = wallPoints.map(p => ({
            x: p.x + offsetX,
            y: p.y + offsetY,
            label: p.label
        }));

        // Dibujar geometría del muro
        this.drawPolyline(puntosDesplazados);

        let sueloDesplazado = null;

        // =====================
        // Caso especial: muro de drenaje
        // =====================
        if (wallType === 'DRENAJE') {
            const B18 = ValidationUtils.validateNumber(predim.inputValues.B18, 6.4);
            const B19 = ValidationUtils.validateNumber(predim.inputValues.B19, 1);
            const D51 = ValidationUtils.validateNumber(predim.inputValues.D51, 0.1);

            const H_val = B18 + B19;
            const puntoalto = altoPlano / 2;
            const baseTotal = D51 * H_val;

            // Puntos del suelo delante
            const sueloDelante = [
                { x: baseTotal / 3, y: puntoalto + B19, label: 'SD1' },
                { x: 0, y: puntoalto + B19, label: 'SD2' }
            ];

            sueloDesplazado = sueloDelante.map(p => ({
                x: p.x + offsetX,
                y: p.y + offsetY,
                label: p.label
            }));

            // Dibujar suelo
            this.d.addLayer(`SUELO_${wallType}`, Drawing.ACI.GREEN, 'DASHED');
            this.d.setActiveLayer(`SUELO_${wallType}`);
            this.drawPolyline(sueloDesplazado);

            // === TUBOS PB ===
            const ySuelo = sueloDesplazado[0].y;
            const yTope = puntosDesplazados[4]?.y;

            if (yTope && yTope > ySuelo + 1) {
                this.d.addLayer('TUBO_PB', Drawing.ACI.RED, 'CONTINUOUS');
                this.d.setActiveLayer('TUBO_PB');

                const paso = 1.0;
                const separacion = 0.05;
                const anguloRad = 20 * Math.PI / 180;

                const pIzqBase = puntosDesplazados[5];
                const pIzqTop = puntosDesplazados[6];
                const pDerBase = puntosDesplazados[3];
                const pDerTop = puntosDesplazados[4];

                const dxIzq = pIzqTop.x - pIzqBase.x;
                const dyIzq = pIzqTop.y - pIzqBase.y;
                const dxDer = pDerTop.x - pDerBase.x;
                const dyDer = pDerTop.y - pDerBase.y;

                let i = 1;
                while (true) {
                    const yInicio = ySuelo + paso * i;
                    if (yInicio > yTope) break;

                    const tIzq = (yInicio - pIzqBase.y) / dyIzq;
                    if (tIzq < 0 || tIzq > 1) {
                        i++;
                        continue;
                    }
                    const xInicio = pIzqBase.x + tIzq * dxIzq;

                    const cosAngulo = Math.cos(anguloRad);
                    const sinAngulo = Math.sin(anguloRad);

                    let xFin = null, yFin = null;

                    const denominator = cosAngulo * dyDer - sinAngulo * dxDer;
                    if (Math.abs(denominator) > 1e-10) {
                        const numerator = (pDerBase.x - xInicio) * dyDer - (pDerBase.y - yInicio) * dxDer;
                        const t = numerator / denominator;
                        const s = ((xInicio + t * cosAngulo) - pDerBase.x) / dxDer;

                        if (s >= 0 && s <= 1 && t > 0) {
                            xFin = xInicio + t * cosAngulo;
                            yFin = yInicio + t * sinAngulo;
                        }
                    }

                    if (xFin === null) {
                        const tDer = (yInicio - pDerBase.y) / dyDer;
                        if (tDer >= 0 && tDer <= 1) {
                            const xDerecho = pDerBase.x + tDer * dxDer;
                            const anchoDisponible = xDerecho - xInicio;
                            const longitudMax = Math.min(anchoDisponible * 0.8, 0.5);

                            xFin = xInicio + longitudMax * cosAngulo;
                            yFin = yInicio + longitudMax * sinAngulo;
                        } else {
                            i++;
                            continue;
                        }
                    }

                    // Línea doble para tubo
                    this.d.drawLine(xInicio, yInicio + separacion / 2, xFin, yFin + separacion / 2);
                    this.d.drawLine(xInicio, yInicio - separacion / 2, xFin, yFin - separacion / 2);

                    i++;
                }
            }
        }

        // =====================
        // Cotas
        // =====================
        if (wallType !== 'MC3D') {
            if (wallPoints.params) {
                if (wallType === 'DRENAJE') {
                    this.dimensionSystem.addDrainageDimensions(puntosDesplazados, sueloDesplazado, wallPoints.params, wallType, predim);
                } else {
                    this.dimensionSystem.addProfessionalDimensions(puntosDesplazados, wallPoints.params, wallType, predim);
                }
            } else {
                console.warn(`⚠️ No se encontraron parámetros para el muro ${wallType}`);
            }
        }

        // =====================
        // Título
        // =====================
        this.annotationSystem.addProfessionalTitle(offsetX, offsetY, wallType, '1:50', predim);

        return puntosDesplazados;
    }

    render3DWall(wallPoints, offsetX, offsetY, wallType, predim, altoPlano) {
        if (!wallPoints || wallPoints.length === 0) {
            console.error(`❌ No hay puntos para dibujar el muro ${wallType}`);
            return [];
        }

        this.d.addLayer(`MURO_${wallType}`, Drawing.ACI.WHITE, 'CONTINUOUS');
        this.d.setActiveLayer(`MURO_${wallType}`);

        // === 1. Desplazar puntos base a la posición final en el plano ===
        const base = wallPoints.map(p => ({
            x: p.x + offsetX,
            y: p.y + offsetY,
            label: p.label
        }));

        // === 2. Dibujar muro frontal ===
        this.drawPolyline(base);

        // === 3. Calcular puntos proyectados (ángulo 45° en 2D) ===
        const desplazamiento = 2; // magnitud de proyección
        const proy = base.map(p => ({
            x: p.x + desplazamiento,
            y: p.y + desplazamiento,
            label: p.label + '_3D'
        }));

        // === 4. Dibujar líneas entre original y proyectado ===
        for (let i = 0; i < base.length; i++) {
            this.d.drawLine(base[i].x, base[i].y, proy[i].x, proy[i].y);
        }

        // === 5. (Opcional) unir puntos proyectados en cierto orden ===
        this.drawPolyline(proy);

        // === 6. Mostrar en consola para modificar uno por uno ===
        base.forEach((p, i) => console.log(`P${i + 1}: (${p.x}, ${p.y})`));

        proy.forEach((p, i) => console.log(`P${i + 1}_3D: (${p.x}, ${p.y})`));

        this.annotationSystem.addProfessionalTitle(offsetX, offsetY, wallType, '1:50', predim);

        return { base, proy };
    }

    renderDrainageElements(offsetX, offsetY, predim, altoPlano) {
        // Lógica específica para elementos de drenaje (suelo, tubos PB)
    }
}

class SteelRenderer {
    constructor(drawing, drawingSystem, annotationSystem, dimensionSystem) {
        this.d = drawing;
        this.drawingSystem = drawingSystem;
        this.annotationSystem = annotationSystem;
        this.dimensionSystem = dimensionSystem
    }

    drawPolyline(points) {
        if (!points || points.length < 2) return;

        for (let i = 0; i < points.length - 1; i++) {
            if (points[i] && points[i + 1]) {
                this.d.drawLine(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
            }
        }
    }

    renderInternalContour(contour, offsetX, offsetY, wallType = 'REFUERZO') {
        if (!contour || contour.length === 0) {
            console.error('❌ No hay contorno interno para dibujar');
            return;
        }

        try {
            this.d.setActiveLayer('CONTORNO');

            // Desplazar puntos del contorno interno
            const puntosDesplazados = contour.map(p => ({
                x: p.x + offsetX,
                y: p.y + offsetY,
                label: p.label
            }));

            // Dibujar la polilínea del contorno interno
            this.drawPolyline(puntosDesplazados);
        } catch (error) {
            console.error(`❌ Error al dibujar contorno interno ${wallType}:`, error);
        }
    }

    renderInternalSteel(steels, offsetX = 0, offsetY = 0, layer = 'ACERO') {
        // Tu función dibujarAcerosInternos() va aquí
        // Crear capa para aceros
        this.d.addLayer(`${layer}_PUNTOS`, Drawing.ACI.YELLOW, 'CONTINUOUS');
        this.d.setActiveLayer(`${layer}_PUNTOS`);

        const grupos = ['rectangle', 'triangle'];
        let totalAceros = 0;

        grupos.forEach(grupo => {
            if (!steels[grupo] || steels[grupo].length === 0) {
                console.warn(`⚠️ No hay aceros en el grupo: ${grupo}`);
                return;
            }

            steels[grupo].forEach((acero, index) => {
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
                this.d.drawCircle(
                    acero.x + offsetX + deltaX,
                    acero.y + offsetY + deltaY,
                    radioPunto
                );

                totalAceros++;
            });
        });
    }

    renderSteelMesh(meshLines, offsetX, offsetY, faceType = 'INTERIOR', concretoArmadoData) {
        if (!meshLines || meshLines.length === 0) {
            console.error('❌ No hay líneas de malla para dibujar');
            return;
        }

        try {
            // Obtener configuración de colores
            const configAcero = CONFIG.ACERO//.TIPOS[faceType];
            const colorPrincipal = Drawing.ACI[configAcero.color] || Drawing.ACI.GREEN;

            // Crear capas específicas
            this.d.addLayer(`MALLA_VERT_${faceType}`, colorPrincipal, 'CONTINUOUS');
            this.d.addLayer(`MALLA_HORIZ_${faceType}`, Drawing.ACI.MAGENTA, 'CONTINUOUS');
            this.d.addLayer(`MARCO_${faceType}`, Drawing.ACI.WHITE, 'CONTINUOUS');

            // Dibujar líneas
            meshLines.forEach((linea) => {
                const x1 = linea.x1 + offsetX;
                const y1 = linea.y1 + offsetY;
                const x2 = linea.x2 + offsetX;
                const y2 = linea.y2 + offsetY;

                if (linea.tipo === 'linea_vertical') {
                    this.d.setActiveLayer(`MALLA_VERT_${faceType}`);
                    this.d.drawLine(x1, y1, x2, y2);
                } else if (linea.tipo === 'linea_horizontal') {
                    this.d.setActiveLayer(`MALLA_HORIZ_${faceType}`);
                    this.d.drawLine(x1, y1, x2, y2);
                } else if (linea.tipo === 'marco') {
                    this.d.setActiveLayer(`MARCO_${faceType}`);
                    this.d.drawLine(x1, y1, x2, y2);
                }
            });

            // Agregar cotas con MLeader y información técnica
            if (meshLines.params) {
                this.dimensionSystem.addDimensionsFaces(offsetX, offsetY, meshLines.params, faceType);
                this.annotationSystem.addSteelLeaderMesh(offsetX, offsetY, meshLines.params, faceType, concretoArmadoData);
                this.annotationSystem.addTitleMallas(offsetX, offsetY, meshLines.params, faceType);
            }

        } catch (error) {
            console.error(`❌ Error dibujando malla ${faceType}:`, error);
        }
    }

    renderAllFaces(anchoPlano, altoPlano, predim, dimen, resultdim, offsetsConfig, concretoArmadoData) {
        //generarYDibujarTodasLasCaras
        const configuracionOffsets = offsetsConfig || {
            INTERIOR: { x: 0, y: 2 },
            EXTERIOR: { x: 10, y: 2 },
            INFERIOR: { x: 20, y: 2 },
            SUPERIOR: { x: 30, y: 2 }
        };

        const tiposCaras = ['INTERIOR', 'EXTERIOR', 'INFERIOR', 'SUPERIOR'];

        tiposCaras.forEach((tipoCara) => {
            // Obtener offset específico para esta cara
            const offset = configuracionOffsets[tipoCara];

            if (!offset) {
                console.error(`❌ No se encontró configuración de offset para ${tipoCara}`);
                return;
            }

            // Generar malla específica para este tipo de cara
            const meshLines = SteelGenerator.generateSteelMesh(anchoPlano, altoPlano, predim, dimen, resultdim, tipoCara);
            if (meshLines && meshLines.length > 0) {
                // Dibujar la malla con su offset correspondiente
                this.renderSteelMesh(meshLines, offset.x, offset.y, tipoCara, concretoArmadoData);
            } else {
                console.error(`❌ Error: No se pudo generar la malla para ${tipoCara}`);
            }
        });
    }
}

// ====================================
// 8. ORQUESTADOR PRINCIPAL
// ====================================

class DXFOrchestrator {
    constructor() {
        this.drawing = new Drawing();
        this.drawing.setUnits(CONFIG.DRAWING.UNITS);

        this.drawingSystem = new DrawingSystem(this.drawing);
        this.dimensionSystem = new DimensionSystem(this.drawing);
        this.annotationSystem = new AnnotationSystem(this.drawing);

        this.wallRenderer = new WallRenderer(
            this.drawing,
            this.drawingSystem,
            this.dimensionSystem,
            this.annotationSystem
        );

        this.steelRenderer = new SteelRenderer(
            this.drawing,
            this.drawingSystem,
            this.annotationSystem,
            this.dimensionSystem
        );
    }

    generateCompletePlan(predim, dimen, resultdim, concretoArmadoData, planConfig = {}) {
        try {
            // 1. Validar datos de entrada
            if (!ValidationUtils.validateDrawingData(predim, dimen, resultdim)) {
                throw new Error('Datos de entrada inválidos');
            }

            // 2. Calcular dimensiones del plano
            const planDimensions = this.calculatePlanDimensions(predim);

            // 3. Dibujar marco del plano
            this.drawingSystem.drawFrame(0, 0, planDimensions.width, planDimensions.height);

            // 4. Generar geometrías base
            const geometries = this.generateBaseGeometries(planDimensions, predim, dimen, resultdim);

            // 5. Renderizar muros principales
            this.renderMainWalls(geometries, planDimensions, predim, concretoArmadoData);

            // 6. Renderizar sistemas de refuerzo
            this.renderReinforcementSystems(geometries, planDimensions, predim, dimen, resultdim, concretoArmadoData);

            // 7. Finalizar y retornar
            return this.finalizePlan();

        } catch (error) {
            console.error('❌ Error en generación de plano:', error);
            throw error;
        }
    }

    calculatePlanDimensions(predim) {
        return {
            width: 45 + predim.inputValues.B18,
            height: 30 + predim.inputValues.B18
        };
    }

    generateBaseGeometries(planDimensions, predim, dimen, resultdim) {
        return {
            wallPoints: WallGeometryGenerator.generateWallPoints(
                planDimensions.width, planDimensions.height, predim, dimen, resultdim
            ),
            wall3DPoints: WallGeometryGenerator.generateWall3DPoints(
                planDimensions.width, planDimensions.height, predim, dimen, resultdim
            ),
            internalContours: null, // Se calculará después
            internalSteels: null    // Se calculará después
        };
    }

    renderMainWalls(geometries, planDimensions, predim, concretoArmadoData) {
        const margin = CONFIG.DRAWING.MARGIN;
        const spacingX = CONFIG.DRAWING.SPACING.X;

        // Posiciones base
        const baseOffsetX = margin + 4;
        const baseOffsetY = margin + 2;

        // Muro 1: REFUERZO (con sistemas internos)
        const offset1 = { x: baseOffsetX, y: baseOffsetY };

        this.wallRenderer.renderCompleteWall(
            geometries.wallPoints, offset1.x, offset1.y, 'REFUERZO', predim, planDimensions.height
        );

        // Generar y renderizar sistemas internos para REFUERZO
        geometries.internalContours = WallGeometryGenerator.generateInternalContour(geometries.wallPoints);
        geometries.internalSteels = SteelGenerator.generateInternalSteel(geometries.internalContours);
        this.steelRenderer.renderInternalContour(geometries.internalContours.triangleStalk, offset1.x, offset1.y);
        this.steelRenderer.renderInternalContour(geometries.internalContours.rectangleBase, offset1.x, offset1.y);
        this.steelRenderer.renderInternalSteel(geometries.internalSteels, offset1.x, offset1.y);

        this.annotationSystem.addInternalStructureLeaders(geometries.internalContours, offset1.x, offset1.y, concretoArmadoData);
        this.annotationSystem.addSteelLeaderDimensions(geometries.internalSteels, offset1.x, offset1.y, concretoArmadoData);

        // Muro 2: DRENAJE
        const offset2 = { x: baseOffsetX + spacingX, y: baseOffsetY };

        this.wallRenderer.renderCompleteWall(
            geometries.wallPoints, offset2.x, offset2.y, 'DRENAJE', predim, planDimensions.height
        );

        // Muro 3: VISTA 3D
        const offset3 = { x: baseOffsetX + (spacingX * 2), y: baseOffsetY };

        this.wallRenderer.render3DWall(
            geometries.wall3DPoints, offset3.x, offset3.y, 'MC3D', predim, planDimensions.height
        );
    }

    renderReinforcementSystems(geometries, planDimensions, predim, dimen, resultdim, concretoArmadoData) {
        const facesOffsetY = 1;
        const spacingX = CONFIG.DRAWING.SPACING.X;
        const baseOffsetX = CONFIG.DRAWING.MARGIN + 4;

        // Configurar offsets para las caras de malla
        const offsetsConfig = {
            INTERIOR: { x: baseOffsetX, y: facesOffsetY },
            EXTERIOR: { x: baseOffsetX + spacingX, y: facesOffsetY },
            INFERIOR: { x: baseOffsetX + (spacingX * 2), y: facesOffsetY },
            SUPERIOR: { x: baseOffsetX + (spacingX * 3), y: facesOffsetY }
        };
        this.steelRenderer.renderAllFaces(
            planDimensions.width, planDimensions.height,
            predim, dimen, resultdim, offsetsConfig, concretoArmadoData
        );
    }

    finalizePlan() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `plano_muro_profesional_${timestamp}.dxf`;
        const filePath = path.join(CONFIG.DIRECTORIES.DOCUMENTS, fileName);

        // Crear directorio si no existe
        if (!fs.existsSync(CONFIG.DIRECTORIES.DOCUMENTS)) {
            fs.mkdirSync(CONFIG.DIRECTORIES.DOCUMENTS, { recursive: true });
        }

        // Guardar archivo
        fs.writeFileSync(filePath, this.drawing.toDxfString());

        return {
            fileName,
            filePath,
            success: true
        };
    }
}

// ====================================
// 9. INFORMACION DEL SISTEMA Y LEYENDA
// ====================================

class informacionleyenda { }
// ====================================
// 10. RUTAS DE LA API
// ====================================

app.use('/documents', express.static(CONFIG.DIRECTORIES.DOCUMENTS));

// Ruta principal de exportación
app.post('/exportar', (req, res) => {
    try {
        const { x = 0, y = 0, predim = {}, dimen = {}, resultdim = {}, concretoArmadoData = [], } = req.body;

        // Validar datos antes de procesar
        if (!ValidationUtils.validateDrawingData(predim, dimen, resultdim)) {
            console.error('❌ Validación de datos falló');
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                received: { predim, dimen, resultdim }
            });
        }
        const orchestrator = new DXFOrchestrator();
        const result = orchestrator.generateCompletePlan(predim, dimen, resultdim, concretoArmadoData);
        // Verificar que el archivo existe
        if (!fs.existsSync(result.filePath)) {
            throw new Error(`Archivo no encontrado: ${result.filePath}`);
        }
        // Enviar archivo para descarga
        res.download(result.filePath, result.fileName, (err) => {
            if (err) {
                console.error('⚠️ Error al enviar el archivo:', err);
                res.status(500).json({ success: false, message: 'Error al descargar el archivo' });
            } else {
            }
        });

    } catch (error) {
        console.error('❌ Error detallado en /exportar:', {
            message: error.message,
            stack: error.stack,
            body: req.body
        });

        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Ruta de validación
app.post('/validar-parametros', (req, res) => {
    try {
        const { predim, dimen, resultdim } = req.body;

        if (!ValidationUtils.validateDrawingData(predim, dimen, resultdim)) {
            return res.status(400).json({ error: 'Datos inválidos' });
        }

        const wallPoints = WallGeometryGenerator.generateWallPoints(100, 100, predim, dimen, resultdim);

        res.json({
            success: true,
            points: wallPoints.length,
            parameters: wallPoints.params
        });

    } catch (error) {
        res.status(500).json({ error: 'Error al validar parámetros', details: error.message });
    }
});

// Ruta de salud
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        message: 'Sistema DXF modular funcionando',
        version: '3.0.0'
    });
});

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    // console.log(`🟢 Servidor DXF modular activo en puerto ${PORT}`);
    // console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    // console.log(`📡 Endpoint DXF: http://localhost:${PORT}/exportar`);
});