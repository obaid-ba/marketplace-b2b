import { configure } from '@testing-library/react'

// findBy… / waitFor : 5 s au lieu de 1 s. Les pages chargées à la demande (lazy) peuvent dépasser 1 s
// quand toute la suite tourne en parallèle, ce qui rendait certains tests instables.
configure({ asyncUtilTimeout: 5000 })
