/** Erreur de chargement avec un bouton de nouvelle tentative. */
export default function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
      <p className="font-medium">Le tableau de bord n'a pas pu être chargé.</p>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn mt-4 border border-rose-300 bg-white text-rose-700 hover:bg-rose-100">
          Réessayer
        </button>
      )}
    </div>
  )
}
