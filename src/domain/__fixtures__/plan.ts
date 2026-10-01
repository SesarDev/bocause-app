/**
 * Plan sintético para los tests. NO son datos reales del PDF: es una maqueta pequeña con
 * la misma forma que el plan de verdad (franjas distintas por persona, comida y cena
 * compartidas con raciones por persona, pan solo para uno, domingo vacío).
 *
 * Los datos reales se extraen en la fase 3 a data/plans/*.json.
 */
import type { Block, Food, Plan, TemplateCell } from '../schema';

export const CRISTINA = 'cristina';
export const ANDRES = 'andres';

/** Lunes de la semana de referencia en los tests. */
export const WEEK_START = '2026-09-28';

const foods: Food[] = [
  {
    key: 'pechuga-pavo',
    name: 'Pechuga de pavo',
    section: 'charcuteria',
    unit: 'g',
    batchable: false,
  },
  { key: 'pollo', name: 'Pollo', section: 'carniceria', unit: 'g', batchable: true, keepsDays: 3 },
  { key: 'arroz', name: 'Arroz', section: 'despensa', unit: 'g', batchable: true, keepsDays: 4 },
  {
    key: 'pan-barra-integral',
    name: 'Pan de barra integral',
    section: 'panaderia',
    unit: 'g',
    batchable: false,
  },
  { key: 'platano', name: 'Plátano', section: 'fruteria', unit: 'ud', batchable: false },
  { key: 'huevo', name: 'Huevo', section: 'lacteos_huevos', unit: 'ud', batchable: false },
  {
    key: 'jamon-serrano',
    name: 'Jamón serrano',
    section: 'charcuteria',
    unit: 'g',
    batchable: false,
  },
  {
    key: 'aove',
    name: 'Aceite de oliva virgen extra',
    section: 'despensa',
    unit: 'ml',
    batchable: false,
  },
];

const blocks: Block[] = [
  {
    id: 'des-c',
    planId: 'test',
    slot: 'desayuno',
    scope: CRISTINA,
    isOriginal: true,
    sections: [
      {
        id: 'des-c-s1',
        kind: 'plato',
        title: 'Tostada con pavo',
        items: [
          {
            id: 'des-c-pan',
            foodKey: 'pan-barra-integral',
            label: 'Pan de barra integral',
            portions: { [CRISTINA]: { rawG: 40 } },
          },
          {
            id: 'des-c-pavo',
            foodKey: 'pechuga-pavo',
            label: 'Pechuga de pavo',
            portions: { [CRISTINA]: { rawG: 50, measure: '3 lonchas finas' } },
          },
        ],
      },
    ],
  },
  {
    id: 'des-a',
    planId: 'test',
    slot: 'desayuno',
    scope: ANDRES,
    isOriginal: true,
    sections: [
      {
        id: 'des-a-s1',
        kind: 'plato',
        title: 'Tostada con pavo',
        items: [
          {
            id: 'des-a-pan',
            foodKey: 'pan-barra-integral',
            label: 'Pan de barra integral',
            portions: { [ANDRES]: { rawG: 80 } },
          },
          {
            id: 'des-a-pavo',
            foodKey: 'pechuga-pavo',
            label: 'Pechuga de pavo',
            portions: { [ANDRES]: { rawG: 100 } },
          },
        ],
      },
    ],
  },
  {
    id: 'snack-c',
    planId: 'test',
    slot: 'snack',
    scope: CRISTINA,
    isOriginal: true,
    sections: [
      {
        id: 'snack-c-s1',
        kind: 'plato',
        items: [
          {
            id: 'snack-c-platano',
            foodKey: 'platano',
            label: 'Plátano',
            portions: { [CRISTINA]: { units: 1 } },
          },
        ],
      },
    ],
  },
  {
    id: 'almuerzo-a',
    planId: 'test',
    slot: 'almuerzo',
    scope: ANDRES,
    isOriginal: true,
    sections: [
      {
        id: 'almuerzo-a-s1',
        kind: 'plato',
        items: [
          {
            id: 'almuerzo-a-platano',
            foodKey: 'platano',
            label: 'Plátano',
            portions: { [ANDRES]: { units: 2 } },
          },
        ],
      },
    ],
  },
  // Comida del lunes: compartida, con pan solo para Cristina.
  {
    id: 'comida-lun',
    planId: 'test',
    slot: 'comida',
    scope: 'shared',
    isOriginal: true,
    sections: [
      {
        id: 'comida-lun-plato',
        kind: 'plato',
        title: 'Pollo con arroz',
        items: [
          {
            id: 'comida-lun-pollo',
            foodKey: 'pollo',
            label: 'Pollo',
            portions: {
              [CRISTINA]: { rawG: 120, cookedG: 90 },
              [ANDRES]: { rawG: 180, cookedG: 140 },
            },
          },
          {
            id: 'comida-lun-arroz',
            foodKey: 'arroz',
            label: 'Arroz',
            portions: {
              [CRISTINA]: { rawG: 60, cookedG: 150 },
              [ANDRES]: { rawG: 80, cookedG: 200 },
            },
          },
          {
            id: 'comida-lun-aove',
            foodKey: 'aove',
            label: 'Aceite de oliva virgen extra',
            portions: {
              [CRISTINA]: { ml: 10, measure: '1 cucharada' },
              [ANDRES]: { ml: 10, measure: '1 cucharada' },
            },
          },
        ],
      },
      {
        id: 'comida-lun-pan',
        kind: 'pan',
        items: [
          {
            id: 'comida-lun-pan-item',
            foodKey: 'pan-barra-integral',
            label: 'Pan de barra integral',
            portions: { [CRISTINA]: { rawG: 40 } },
          },
        ],
      },
      {
        id: 'comida-lun-postre',
        kind: 'postre',
        items: [
          {
            id: 'comida-lun-postre-item',
            foodKey: 'platano',
            label: 'Plátano',
            portions: { [CRISTINA]: { units: 1 }, [ANDRES]: { units: 1 } },
          },
        ],
      },
    ],
  },
  // Comida del martes: se repite el pollo (sirve para batch cooking).
  {
    id: 'comida-mar',
    planId: 'test',
    slot: 'comida',
    scope: 'shared',
    isOriginal: true,
    sections: [
      {
        id: 'comida-mar-plato',
        kind: 'plato',
        title: 'Pollo con arroz',
        items: [
          {
            id: 'comida-mar-pollo',
            foodKey: 'pollo',
            label: 'Pollo',
            portions: { [CRISTINA]: { rawG: 120 }, [ANDRES]: { rawG: 180 } },
          },
          {
            id: 'comida-mar-sal',
            label: 'Especias al gusto',
            portions: { [CRISTINA]: { measure: 'al gusto' }, [ANDRES]: { measure: 'al gusto' } },
          },
        ],
      },
    ],
  },
  // Cena del lunes: huevos rotos, con jamón en distinta cantidad para cada uno.
  {
    id: 'cena-lun',
    planId: 'test',
    slot: 'cena',
    scope: 'shared',
    isOriginal: true,
    sections: [
      {
        id: 'cena-lun-plato',
        kind: 'plato',
        title: 'Huevos rotos con jamón',
        items: [
          {
            id: 'cena-lun-huevo',
            foodKey: 'huevo',
            label: 'Huevo',
            portions: { [CRISTINA]: { units: 2 }, [ANDRES]: { units: 3 } },
          },
          {
            id: 'cena-lun-jamon',
            foodKey: 'jamon-serrano',
            label: 'Jamón serrano',
            portions: {
              [CRISTINA]: { rawG: 60, measure: '6-8 lonchas' },
              [ANDRES]: { rawG: 30, measure: '3-4 lonchas' },
            },
          },
        ],
      },
    ],
  },
];

/** Plantilla original: lunes y martes con comida; el domingo queda vacío a propósito. */
const template: TemplateCell[] = [
  { day: 0, slot: 'desayuno', scope: CRISTINA, blockId: 'des-c' },
  { day: 0, slot: 'snack', scope: CRISTINA, blockId: 'snack-c' },
  { day: 0, slot: 'desayuno', scope: ANDRES, blockId: 'des-a' },
  { day: 0, slot: 'almuerzo', scope: ANDRES, blockId: 'almuerzo-a' },
  { day: 0, slot: 'comida', scope: 'shared', blockId: 'comida-lun' },
  { day: 0, slot: 'cena', scope: 'shared', blockId: 'cena-lun' },
  { day: 1, slot: 'comida', scope: 'shared', blockId: 'comida-mar' },
  { day: 6, slot: 'comida', scope: 'shared', blockId: null },
  { day: 6, slot: 'cena', scope: 'shared', blockId: null },
];

export const testPlan: Plan = {
  id: 'test',
  name: 'Plan de prueba',
  issuedOn: '2026-09-27',
  validFrom: WEEK_START,
  profiles: [
    {
      profileId: CRISTINA,
      displayName: 'Cristina',
      slots: ['desayuno', 'snack', 'snack2', 'comida', 'cena'],
      training: ['Gimnasio', null, null, null, null, null, null],
      supplements: [],
      comodin: [{ id: 'comodin-pavo', label: 'Pechuga de pavo', amount: '50 g' }],
    },
    {
      profileId: ANDRES,
      displayName: 'Andrés',
      slots: ['desayuno', 'almuerzo', 'comida', 'cena'],
      training: ['Gimnasio', null, 'Running', null, null, 'Caminar', null],
      supplements: [],
      comodin: [{ id: 'comodin-pavo', label: 'Pechuga de pavo', amount: '100 g' }],
    },
  ],
  blocks,
  template,
  recipes: [],
  foods,
  rules: {
    aoveMaxSpoonsPerWeek: 14,
    freeMealsPerWeek: 2,
    waterLitersMin: 2,
    waterLitersMax: 3,
    comodinRequired: true,
    recommendations: [],
  },
};

export const testFoods = foods;
