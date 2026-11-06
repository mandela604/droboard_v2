'use strict';
// Author-facing messaging alias — re-mounts user messaging endpoints under
// /api/author/messages so author-console pages can use the same service as readers.
const router = require('./messages.routes');

module.exports = router;
