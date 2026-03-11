/**
 * Pollen Groups Data
 * 
 * Groups plants by botanical family. Plants marked with isAtmo: true
 * have real data from the ATMO API. Others are estimated based on
 * their reference taxon (code property).
 */

export const POLLEN_GROUPS = [
  {
    id: 'betulaceae',
    name: 'Betulaceae',
    icon: '🌳',
    description: 'Arbres à chatons',
    plants: [
      { name: 'Aulne', code: 'aul', isAtmo: true },
      { name: 'Bouleau', code: 'boul', isAtmo: true },
      { name: 'Noisetier', code: 'aul', isAtmo: false, note: 'Calqué sur Aulne' },
      { name: 'Charme', code: 'boul', isAtmo: false, note: 'Calqué sur Bouleau' },
      { name: 'Chêne', code: 'boul', isAtmo: false, note: 'Calqué sur Bouleau' },
      { name: 'Hêtre', code: 'boul', isAtmo: false, note: 'Calqué sur Bouleau' },
    ]
  },
  {
    id: 'oleaceae',
    name: 'Oleaceae',
    icon: '🫒',
    description: 'Famille de l\'olivier',
    plants: [
      { name: 'Olivier', code: 'oliv', isAtmo: true },
      { name: 'Frêne', code: 'oliv', isAtmo: false, note: 'Calqué sur Olivier' },
      { name: 'Troène', code: 'oliv', isAtmo: false, note: 'Calqué sur Olivier' },
    ]
  },
  {
    id: 'poaceae',
    name: 'Poaceae',
    icon: '🌾',
    description: 'Graminées et céréales',
    plants: [
      { name: 'Graminées', code: 'gram', isAtmo: true },
      { name: 'Blé', code: 'gram', isAtmo: false, note: 'Céréale = graminée' },
      { name: 'Orge', code: 'gram', isAtmo: false, note: 'Céréale = graminée' },
      { name: 'Seigle', code: 'gram', isAtmo: false, note: 'Céréale = graminée' },
    ]
  },
  {
    id: 'asteraceae',
    name: 'Asteraceae',
    icon: '🌻',
    description: 'Armoise & Ambroisie',
    plants: [
      { name: 'Armoise', code: 'arm', isAtmo: true },
      { name: 'Ambroisie', code: 'ambr', isAtmo: true },
      { name: 'Tournesol', code: 'ambr', isAtmo: false, note: 'Calqué sur Ambroisie' },
      { name: 'Camomille', code: 'arm', isAtmo: false, note: 'Calqué sur Armoise' },
    ]
  },
];

/**
 * Get the pollen level for a plant based on API data
 * @param {Object} plant - Plant object from POLLEN_GROUPS
 * @param {Array} pollenData - Array of pollen data from API
 * @returns {number} - Level from 0-6
 */
export function getPlantLevel(plant, pollenData) {
  if (!pollenData || !Array.isArray(pollenData)) return 0;

  const pollen = pollenData.find(p => p.code === plant.code);
  return pollen?.level ?? 0;
}
