import NavBar from '../../components/hw/NavBar';

/**
 * PUB-2 scaffold — public impact page. Templated only. Real charts come later.
 */
export default function ImpactPage() {
  return (
    <div>
      <NavBar />
      <section className="container my-5">
        <h1>Our Impact</h1>
        <p className="text-muted">PUB-2 — public impact   SDFGHJKKJHGFDSSDFGHJHRFGHJK dashboard (scaffold)</p>

        <div className="row mt-4 g-3">
          <div className="col-md-3">
            <div className="card p-3">
              <div className="small text-muted">Residents served</div>
              <div className="h3">—</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card p-3">
              <div className="small text-muted">Successful reintegrations</div>
              <div className="h3">—</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card p-3">
              <div className="small text-muted">Safehouses</div>
              <div className="h3">—</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card p-3">
              <div className="small text-muted">Donations total</div>
              <div className="h3">—</div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-muted small">
          Real metrics will wire up to <code>/api/impact</code> (or aggregated
          queries) in a follow-up card.
        </p>
      </section>
    </div>
  );
}
