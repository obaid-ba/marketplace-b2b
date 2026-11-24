import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ProductImage from './ProductImage'

afterEach(cleanup)

describe('ProductImage', () => {
  it('affiche la photo', () => {
    render(<ProductImage src="/a.jpg" alt="Cartons" seed={1} label="Image produit" />)
    expect(screen.getByAltText('Cartons').getAttribute('src')).toBe('/a.jpg')
  })

  it('sans photo, affiche le dégradé', () => {
    render(<ProductImage src={null} alt="Cartons" seed={1} label="Image produit" />)
    expect(screen.queryByAltText('Cartons')).toBeNull()
    expect(screen.getByText('Image produit')).toBeTruthy()
  })

  it('remplace une photo introuvable par le dégradé, puis essaie une autre photo', () => {
    const { rerender } = render(<ProductImage src="/a.jpg" alt="Cartons" seed={1} label="Image produit" />)
    fireEvent.error(screen.getByAltText('Cartons'))
    expect(screen.getByText('Image produit')).toBeTruthy()

    rerender(<ProductImage src="/b.jpg" alt="Cartons" seed={1} label="Image produit" />)
    expect(screen.getByAltText('Cartons').getAttribute('src')).toBe('/b.jpg')
  })
})
