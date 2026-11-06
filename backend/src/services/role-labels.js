'use strict';
/* One authority for turning a stored snake_case role token into the Title-Case
   label the consoles and the chat page display. Backend stores snake_case
   (User.roles / User.primaryRole); every read surface shows Title-Case.

   preRole/backRole are the same pair the super-admin user list has always used,
   hoisted here so a second map cannot drift away from it. */

const ROLE_LABEL = {
  reader: 'Reader', writer: 'Writer', senior_editor: 'Senior Editor',
  chief_editor: 'Chief Editor', finance: 'Finance', admin: 'Admin', marketing: 'Marketing',
};
const LABEL_ROLE = Object.fromEntries(Object.entries(ROLE_LABEL).map(([k, v]) => [v, k]));

function roleLabel(token) {
  return ROLE_LABEL[token] || (token ? String(token).charAt(0).toUpperCase() + String(token).slice(1) : 'Reader');
}
function roleToken(label) {
  return LABEL_ROLE[label] || String(label || '').toLowerCase().replace(/\s+/g, '_');
}

/* When a user carries several roles, the most privileged one is the identity
   other people see in a thread, so presence of `admin` outranks `writer`. */
const AUTHORITY = ['admin', 'chief_editor', 'senior_editor', 'finance', 'marketing', 'writer', 'reader'];

/* primaryRole is what an admin last set, so it wins. But the schema default is
   'reader' and staff rows are created with roles[] before anyone touches it —
   the same reason chief-editors.service repairs it on grant ("if (!primaryRole
   || primaryRole === 'reader')"). So an unset 'reader' never outvales a real
   held role; it only wins once the user actually holds it. */
function primaryRoleToken(user) {
  const roles = (user && user.roles) || [];
  const stored = user && user.primaryRole;
  if (stored && stored !== 'reader' && ROLE_LABEL[stored]) return stored;
  for (const r of AUTHORITY) if (roles.includes(r)) return r;
  if (stored && ROLE_LABEL[stored]) return stored;
  return roles[0] || 'reader';
}

/* The display label for a user row, honouring primaryRole then the rank list. */
function roleLabelFor(user) {
  return roleLabel(primaryRoleToken(user));
}

module.exports = { ROLE_LABEL, LABEL_ROLE, roleLabel, roleToken, primaryRoleToken, roleLabelFor, AUTHORITY };
