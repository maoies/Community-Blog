'use strict';
const form = document.getElementById('member-form');
const message = document.getElementById('form-message');
const submitButton = document.getElementById('submit-button');
const cancelButton = document.getElementById('cancel-button');
const fields = ['fullName', 'email', 'age', 'phone', 'address'];
let editingId = null;
let submitted = false;

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Unable to save member.');
  return result;
}

function showMessage(text, type) {
  message.textContent = text;
  message.className = `alert alert-${type}`;
}

function setErrors(errors) {
  for (const name of fields) {
    const error = errors[name] || '';
    form.elements[name].classList.toggle('is-invalid', Boolean(error));
    form.elements[name].setAttribute('aria-invalid', String(Boolean(error)));
    document.getElementById(`${name}-error`).textContent = error;
  }
}

function resetForm() {
  form.reset();
  editingId = null;
  submitted = false;
  setErrors({});
  submitButton.textContent = 'Register';
  document.getElementById('form-title').textContent = 'Member sign-up';
  cancelButton.classList.add('d-none');
}

async function loadMembers() {
  const state = document.getElementById('list-message');
  try {
    const members = await request('/api/members');
    const tableBody = document.getElementById('members-body');
    tableBody.replaceChildren();
    state.textContent = members.length ? '' : 'No members yet. Submit the form to add the first member.';
    for (const member of members) {
      const row = document.createElement('tr');
      for (const name of fields) {
        const cell = document.createElement('td');
        cell.textContent = member[name] || '—'; // Render user data as text, not HTML.
        row.append(cell);
      }
      const action = document.createElement('td');
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn btn-outline-secondary btn-sm';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => {
        editingId = member.id;
        submitted = false;
        for (const name of fields) form.elements[name].value = member[name];
        setErrors({});
        message.classList.add('d-none');
        submitButton.textContent = 'Save changes';
        document.getElementById('form-title').textContent = 'Edit member';
        cancelButton.classList.remove('d-none');
        form.elements.fullName.focus();
      });
      action.append(edit);
      row.append(action);
      tableBody.append(row);
    }
  } catch {
    state.textContent = 'Unable to load members. Start the project with node server.js and refresh this page.';
  }
}

form.addEventListener('input', () => {
  if (submitted) setErrors(MemberValidation.validateMember(Object.fromEntries(new FormData(form))).errors);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitButton.disabled) return;
  submitted = true;
  const { member, errors, valid } = MemberValidation.validateMember(Object.fromEntries(new FormData(form)));
  setErrors(errors);
  if (!valid) {
    showMessage('Please check the highlighted fields.', 'danger');
    form.querySelector('.is-invalid').focus();
    return;
  }
  submitButton.disabled = true;
  try {
    await request(editingId ? `/api/members/${encodeURIComponent(editingId)}` : '/api/members', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member)
    });
    showMessage(editingId ? 'Member updated successfully.' : 'Registration successful!', 'success');
    resetForm();
    await loadMembers();
  } catch (error) {
    showMessage(error.message, 'danger');
  } finally { submitButton.disabled = false; }
});

cancelButton.addEventListener('click', () => { resetForm(); message.classList.add('d-none'); });
loadMembers();
