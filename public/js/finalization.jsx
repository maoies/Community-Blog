import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { service } from './finalization-api';

const rules = window.FinalizationValidation;
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const labels = { download: 'Download link', email: 'Email link', both: 'Download + email link', pdf: 'PDF', online: 'Online reading', none: 'No updates', weekly: 'Weekly digest', monthly: 'Monthly digest' };
const empty = { fullName: '', email: '', accessMethod: '', readingFormat: '', notificationFrequency: '', notes: '', consent: false };

function ErrorText({ name, errors }) {
  return errors[name] ? <p className="field-error" id={name + '-error'}>{errors[name]}</p> : null;
}

function JsonDocument({ data, open = false }) {
  return <details className="json-document" open={open}>
    <summary>View {open ? 'saved' : 'submission'} JSON document</summary>
    <pre tabIndex="0" aria-label={open ? 'Saved confirmation JSON' : 'JSON request preview'}>{JSON.stringify(data, null, 2)}</pre>
  </details>;
}

function Confirmation({ record }) {
  const [saved, setSaved] = useState(record);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function reload() {
    setLoading(true); setError('');
    try { setSaved(await service.confirmation(record.id)); }
    catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  }
  return <section className="confirmation-panel" aria-labelledby="confirmation-title">
    <span className="confirmation-mark" aria-hidden="true">✓</span>
    <p className="eyebrow">ALL THE DETAILS, IN ONE PLACE</p>
    <h2 id="confirmation-title">You're all set, {saved.options.fullName}.</h2>
    <p className="text-secondary">Your resource selections and reading preferences have been saved.</p>
    <p className="confirmation-reference">Confirmation ID <strong id="confirmation-id">{saved.id}</strong></p>
    <div className="confirmation-grid">
      <div><h3>Your resources</h3><ul className="confirmed-items">{saved.selection.items.map((item) => <li key={item.productId}><span>{item.name} <small>× {item.quantity}</small></span><strong>{money(item.lineSubtotal)}</strong></li>)}</ul><div className="confirmed-total"><span>Catalog value (USD)</span><strong>{money(saved.selection.total)}</strong></div></div>
      <dl className="preference-list"><div><dt>Email</dt><dd>{saved.options.email}</dd></div><div><dt>Access</dt><dd>{labels[saved.options.accessMethod]}</dd></div><div><dt>Reading format</dt><dd>{labels[saved.options.readingFormat]}</dd></div><div><dt>Notifications</dt><dd>{labels[saved.options.notificationFrequency]}</dd></div>{saved.options.notes && <div><dt>Your notes</dt><dd>{saved.options.notes}</dd></div>}</dl>
    </div>
    {error && <p className="alert alert-danger" role="alert">{error}</p>}
    <div className="button-row"><a className="btn btn-primary" href="cart.html">Back to collection →</a><button type="button" className="btn btn-outline-secondary" onClick={reload} disabled={loading}>{loading ? 'Reloading…' : 'Reload saved confirmation'}</button><a className="text-link" href="finalization.html">Start another selection</a></div>
    <JsonDocument data={saved} open />
  </section>;
}

function FinalizationApp() {
  const [initial] = useState(() => {
    try { return { items: window.CommunityCart.read(), notice: '' }; }
    catch (error) { return { items: [], notice: error.message + ' You can choose resources below.' }; }
  });
  const [catalog, setCatalog] = useState([]);
  const [items, setItems] = useState(initial.items);
  const [form, setForm] = useState({ ...empty });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [serverErrors, setServerErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);
  const lock = useRef(false);
  const requestId = useRef(null);
  if (!requestId.current) requestId.current = crypto.randomUUID();

  async function load() {
    setLoading(true); setLoadError('');
    try {
      const products = await service.products(); // React effect -> jQuery AJAX GET -> existing product collection.
      if (!Array.isArray(products)) throw new Error('The service returned an invalid resource collection.');
      setCatalog(products);
    } catch (error) { setLoadError(error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (saved) document.getElementById('confirmation-title')?.scrollIntoView({ block: 'start' }); }, [saved]);

  const draft = { requestId: requestId.current, ...form, items };
  const checked = rules.validate(draft);
  const unavailable = items.filter((item) => !catalog.some((product) => product.productId === item.productId));
  const errors = { ...(attempted ? checked.errors : {}), ...serverErrors };
  if (attempted && unavailable.length) errors.items = 'Remove unavailable resources or reload the collection before submitting.';
  const selected = items.map((item) => ({ ...catalog.find((product) => product.productId === item.productId), ...item }));
  const totalCents = selected.reduce((sum, item) => sum + Math.round((item.price || 0) * 100) * item.quantity, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  function changed() {
    requestId.current = crypto.randomUUID();
    setServerErrors({}); setSubmitError('');
  }
  function update(name, value) { changed(); setForm((current) => ({ ...current, [name]: value })); }
  function toggle(productId) {
    changed();
    setItems((current) => current.some((item) => item.productId === productId)
      ? current.filter((item) => item.productId !== productId) : [...current, { productId, quantity: 1 }]);
  }
  function inputProps(name) {
    return { id: name, name, value: form[name], onChange: (event) => update(name, event.target.value),
      className: 'form-control' + (errors[name] ? ' is-invalid' : ''), 'aria-invalid': Boolean(errors[name]),
      'aria-describedby': errors[name] ? name + '-error' : undefined };
  }
  async function submit(event) {
    event.preventDefault();
    if (lock.current || loading || loadError) return;
    setAttempted(true); setSubmitError('');
    if (!checked.valid || unavailable.length) {
      setSubmitError('Please review the highlighted fields before confirming.');
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    lock.current = true; setBusy(true);
    try {
      // Only a successful REST response changes the React view to a saved confirmation.
      const result = await service.save({ requestId: requestId.current, ...checked.document });
      setSaved(result);
    } catch (error) { setServerErrors(error.errors); setSubmitError(error.message); }
    finally { lock.current = false; setBusy(false); }
  }

  if (saved) return <Confirmation record={saved} />;
  return <>
    <ol className="journey" aria-label="Resource selection steps"><li><span>01</span><a href="cart.html">Choose resources</a></li><li className="current" aria-current="step"><span>02</span>Set your preferences</li><li><span>03</span>Confirmation</li></ol>
    {initial.notice && <p className="alert alert-warning" role="status">{initial.notice}</p>}
    {loadError && <div className="alert alert-danger" role="alert"><p>{loadError}</p><button className="btn btn-outline-secondary btn-sm" onClick={load} type="button">Reload resources</button></div>}
    <div className="preferences-layout">
      <form id="finalization-form" noValidate onSubmit={submit}>
        {submitError && <p className="alert alert-danger" id="submit-error" role="alert">{submitError}</p>}
        <fieldset className="form-body" disabled={busy}>
          <legend className="visually-hidden">Resource access and reading preferences</legend>
          <section className="options-panel" aria-labelledby="details-title"><div className="section-title"><span>01</span><h2 id="details-title">A little about you</h2></div><p className="section-help">Fields marked * are required.</p><div className="row g-3"><div className="col-sm-6"><label className="form-label" htmlFor="fullName">Full name *</label><input {...inputProps('fullName')} autoComplete="name" maxLength="80" required /><ErrorText name="fullName" errors={errors} /></div><div className="col-sm-6"><label className="form-label" htmlFor="email">Email address *</label><input {...inputProps('email')} type="email" autoComplete="email" maxLength="254" required /><ErrorText name="email" errors={errors} /></div></div></section>
          <section className="options-panel" aria-labelledby="resource-title"><div className="section-title"><span>02</span><h2 id="resource-title">Your reading list</h2><button className="text-link reload-resource" type="button" onClick={load} disabled={loading}>Refresh resources</button></div><p className="section-help">Selections from your cart are included. Choose at least one resource. Adjust quantities in your <a href="cart.html">cart</a>.</p>
            <fieldset id="items" className="resource-options" tabIndex="-1" aria-invalid={Boolean(errors.items)} aria-describedby={errors.items ? 'items-error' : undefined}><legend className="visually-hidden">Choose resources *</legend>
              {loading ? <p role="status">Loading resources…</p> : catalog.map((product) => {
                const entry = items.find((item) => item.productId === product.productId);
                return <label className={'resource-choice' + (entry ? ' selected' : '')} key={product.productId}><input className="form-check-input" type="checkbox" checked={Boolean(entry)} onChange={() => toggle(product.productId)} /><span className="book-mark" aria-hidden="true" data-category={product.category}>{product.category.charAt(0)}</span><span className="resource-copy"><strong>{product.name}</strong><small>{product.category} · {product.unitOfMeasure}{entry && entry.quantity > 1 ? ' · Qty ' + entry.quantity : ''}</small></span><span className="resource-price">{money(product.price)}</span></label>;
              })}
              {!loading && !loadError && !catalog.length && <p className="text-secondary">No resources are available. Add a product in the catalog first.</p>}
              {unavailable.map((item) => <div className="unavailable-resource" key={item.productId}>Resource {item.productId} is unavailable. <button className="text-link" type="button" onClick={() => toggle(item.productId)}>Remove from selection</button></div>)}
            </fieldset><ErrorText name="items" errors={errors} />
          </section>
          <section className="options-panel" aria-labelledby="access-title"><div className="section-title"><span>03</span><h2 id="access-title">Read it your way</h2></div>
            <fieldset className="access-options" id="accessMethod" tabIndex="-1" aria-invalid={Boolean(errors.accessMethod)} aria-describedby={errors.accessMethod ? 'accessMethod-error' : undefined}><legend className="form-label">How would you like to get access? *</legend><div className="access-grid">{[['download', '↓', 'Download link', 'Keep a copy for later.'], ['email', '↗', 'Email link', 'A link in your inbox.'], ['both', '✳', 'Both ways', 'A little extra flexibility.']].map(([value, icon, title, description]) => <label className={'access-choice' + (form.accessMethod === value ? ' selected' : '')} key={value}><input className="form-check-input" type="radio" name="accessMethod" value={value} checked={form.accessMethod === value} onChange={() => update('accessMethod', value)} /><span className="access-icon" aria-hidden="true">{icon}</span><strong>{title}</strong><small>{description}</small></label>)}</div></fieldset><ErrorText name="accessMethod" errors={errors} />
            <div className="row g-3 mt-2"><div className="col-sm-6"><label className="form-label" htmlFor="readingFormat">Preferred format *</label><select {...inputProps('readingFormat')} className={'form-select' + (errors.readingFormat ? ' is-invalid' : '')} required><option value="">Choose a format</option><option value="pdf">PDF</option><option value="online">Online reading</option></select><ErrorText name="readingFormat" errors={errors} /></div><div className="col-sm-6"><label className="form-label" htmlFor="notificationFrequency">Community updates *</label><select {...inputProps('notificationFrequency')} className={'form-select' + (errors.notificationFrequency ? ' is-invalid' : '')} required><option value="">Choose a frequency</option><option value="none">No updates</option><option value="weekly">Weekly digest</option><option value="monthly">Monthly digest</option></select><ErrorText name="notificationFrequency" errors={errors} /></div></div>
            <div className="mt-4"><label className="form-label" htmlFor="notes">Anything else? <span className="optional-label">(optional)</span></label><textarea {...inputProps('notes')} rows="3" maxLength="500" placeholder="Share a reading preference or a note for our community team." /><div className="notes-count">{form.notes.length}/500</div><ErrorText name="notes" errors={errors} /></div>
          </section>
          <section className="confirm-options"><label className="form-check"><input id="consent" name="consent" type="checkbox" className={'form-check-input' + (errors.consent ? ' is-invalid' : '')} checked={form.consent} onChange={(event) => update('consent', event.target.checked)} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? 'consent-error' : undefined} /><span className="form-check-label">I have reviewed my resources and reading preferences. *</span></label><ErrorText name="consent" errors={errors} /><button className="btn btn-primary confirm-button" id="confirm-options" type="submit" disabled={loading || Boolean(loadError)}>{busy ? 'Saving your preferences…' : 'Confirm my preferences →'}</button><p className="confirmation-note">This saves your choices for our class project. No payment or delivery is made.</p></section>
        </fieldset>
      </form>
      <aside className="reading-summary" aria-labelledby="reading-summary-title"><p className="eyebrow">A LITTLE INSPIRATION, READY FOR YOU</p><h2 id="reading-summary-title">Your next chapter</h2><div className="summary-book" aria-hidden="true"><span>the<br />community<br /><em>collection.</em></span><b>✳</b></div><p className="summary-count" aria-live="polite">{totalQuantity} resource{totalQuantity === 1 ? '' : 's'} selected</p>{!items.length ? <p className="text-secondary">Your reading list is waiting. Choose a resource to begin.</p> : <ul className="reading-summary-items">{selected.map((item) => <li key={item.productId}><span>{item.name || 'Unavailable resource'} <small>× {item.quantity}</small></span><strong>{money((item.price || 0) * item.quantity)}</strong></li>)}</ul>}<div className="reading-value"><span>Catalog value <small>(USD)</small></span><strong>{money(totalCents / 100)}</strong></div><dl className="preference-list"><div><dt>Access</dt><dd>{labels[form.accessMethod] || 'Your choice'}</dd></div><div><dt>Format</dt><dd>{labels[form.readingFormat] || 'Your choice'}</dd></div><div><dt>Updates</dt><dd>{labels[form.notificationFrequency] || 'Your choice'}</dd></div></dl><a className="text-link" href="cart.html">← Back to your cart</a></aside>
    </div>
    <JsonDocument data={draft} />
  </>;
}

createRoot(document.getElementById('finalization-root')).render(<FinalizationApp />);
