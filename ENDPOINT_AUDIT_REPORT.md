# Debate Endpoints Audit: Frontend vs Backend

**Date**: November 14, 2026  
**Status**: AUDIT COMPLETE - 1 CRITICAL MISMATCH FOUND

---

## Route Mounting Configuration

### Backend Route Registration (server.js)
```
Line 101: app.use('/api', require('./routes/debate-args.routes'));
Line 147: app.use('/api/stories', require('./routes/engagement.routes'));
```

This means:
- **debate-args.routes** endpoints → `/api/...`
- **engagement.routes** endpoints → `/api/stories/...`

---

## Endpoint-by-Endpoint Analysis

### 1. Fetch Debate Metadata (Post-based)
| Aspect | Value |
|--------|-------|
| **Frontend URL** | `GET /api/posts/:postId` |
| **Backend Route** | posts.routes.js (generic post fetch with debateData) |
| **Mounted at** | `/api/posts/:postId` |
| **Status** | ✅ MATCH |

---

### 2. Fetch Debate Metadata (Book/Chapter-level) ⚠️ CRITICAL
| Aspect | Value |
|--------|-------|
| **Frontend URL** | `GET /api/stories/:debateId?book=:bookId&ch=:chapterId` |
| **Backend Route** | `router.get('/debates/:debateId', ...)` in engagement.routes.js (line 53) |
| **Mounted at** | `/api/stories/debates/:debateId` (NOT `/api/stories/:debateId`) |
| **Status** | ❌ **MISMATCH** |
| **Impact** | 404 error when frontend tries to fetch chapter/book debates |

**Problem Details:**
- Frontend: `GET /api/stories/88449915-3d6e-413d-9fa4-3b5520d19823?book=...` → **404 Not Found**
- Backend expects: `GET /api/stories/debates/88449915-3d6e-413d-9fa4-3b5520d19823?book=...`

---

### 3. Fetch Arguments (Post-based)
| Aspect | Value |
|--------|-------|
| **Frontend URL** | `GET /api/posts/:postId/debate/args` |
| **Backend Route** | `router.get('/posts/:postId/debate/args', ...)` debate-args.routes.js (line 14) |
| **Mounted at** | `/api/posts/:postId/debate/args` |
| **Status** | ✅ MATCH |

---

### 4. Fetch Arguments (Book/Chapter-level)
| Aspect | Value |
|--------|-------|
| **Frontend URL** | `GET /api/debates/:debateId/args?book=:bookId&ch=:chapterId` |
| **Backend Route** | `router.get('/debates/:debateId/args', ...)` debate-args.routes.js (line 86) |
| **Mounted at** | `/api/debates/:debateId/args` |
| **Status** | ✅ MATCH |

---

### 5. Create Argument (Post-based)
| Aspect | Value |
|--------|-------|
| **Frontend URL** | `POST /api/posts/:postId/debate/args` |
| **Backend Route** | `router.post('/posts/:postId/debate/args', ...)` debate-args.routes.js (line 30) |
| **Mounted at** | `/api/posts/:postId/debate/args` |
| **Status** | ✅ MATCH |

---

### 6. Create Argument (Book/Chapter-level)
| Aspect | Value |
|--------|-------|
| **Frontend URL** | `POST /api/debates/:debateId/args?book=:bookId&ch=:chapterId` |
| **Backend Route** | `router.post('/debates/:debateId/args', ...)` debate-args.routes.js (line 106) |
| **Mounted at** | `/api/debates/:debateId/args` |
| **Status** | ✅ MATCH |

---

### 7. Edit Argument
| Aspect | Value |
|--------|-------|
| **Frontend URL** | `PATCH /api/debate/args/:id` |
| **Backend Route** | `router.patch('/debate/args/:id', ...)` debate-args.routes.js (line 64) |
| **Mounted at** | `/api/debate/args/:id` |
| **Status** | ✅ MATCH |

---

### 8. Delete Argument
| Aspect | Value |
|--------|-------|
| **Frontend URL** | `DELETE /api/debate/args/:id` |
| **Backend Route** | `router.delete('/debate/args/:id', ...)` debate-args.routes.js (line 78) |
| **Mounted at** | `/api/debate/args/:id` |
| **Status** | ✅ MATCH |

---

### 9. Vote on Argument
| Aspect | Value |
|--------|-------|
| **Frontend URL** | `POST /api/debate/args/:id/vote` |
| **Backend Route** | `router.post('/debate/args/:id/vote', ...)` debate-args.routes.js (line 52) |
| **Mounted at** | `/api/debate/args/:id/vote` |
| **Status** | ✅ MATCH |

---

### 10. Vote on Post-based Debate Side
| Aspect | Value |
|--------|-------|
| **Frontend URL** | `POST /api/posts/:postId/debate/vote` |
| **Backend Route** | `router.post('/:id/debate/vote', ...)` posts.routes.js (line 119) |
| **Mounted at** | `/api/posts/:id/debate/vote` |
| **Status** | ✅ MATCH |

---

### 11. Vote on Chapter-level Debate Side
| Aspect | Value |
|--------|-------|
| **Frontend URL** | `POST /api/stories/:bookId/chapters/:chapterId/debate/vote` |
| **Backend Route** | `router.post('/:bookId/chapters/:key/debate/vote', ...)` engagement.routes.js (line 207) |
| **Mounted at** | `/api/stories/:bookId/chapters/:key/debate/vote` |
| **Status** | ✅ MATCH |

---

### 12. Vote on Book-level Debate Side
| Aspect | Value |
|--------|-------|
| **Frontend URL** | `POST /api/stories/:bookId/engagement/vote` {id, kind: 'debate', side} |
| **Backend Route** | `router.post('/:bookId/engagement/vote', ...)` engagement.routes.js (line 223) |
| **Mounted at** | `/api/stories/:bookId/engagement/vote` |
| **Status** | ✅ MATCH |

---

## Summary

| Total Endpoints | Matching ✅ | Mismatching ❌ |
|---|---|---|
| 12 | 11 | 1 |

---

## Critical Issue: Debate Metadata Endpoint

### Root Cause
The engagement.routes.js defines the debate metadata fetch as:
```javascript
router.get('/debates/:debateId', ...)
```

But engagement.routes is mounted at `/api/stories`, making the full path:
```
/api/stories/debates/:debateId
```

The frontend is calling:
```
/api/stories/:debateId
```

### Fix Required
**Option 1: Fix Backend Route** (RECOMMENDED)
Change engagement.routes.js line 53 from:
```javascript
router.get('/debates/:debateId', ...)
```
To:
```javascript
router.get('/:debateId', ...)
```

This makes the route `/api/stories/:debateId` which matches the frontend call.

**Option 2: Fix Frontend URL**
Change debate-service.js line 124 from:
```javascript
var debateRes = await fetch('/api/stories/' + encodeURIComponent(debateId) + queryStr, ...)
```
To:
```javascript
var debateRes = await fetch('/api/stories/debates/' + encodeURIComponent(debateId) + queryStr, ...)
```

### Decision
**Use Option 1** because:
1. Simpler API path (no extra `/debates` nesting)
2. Matches the pattern of other /api/stories endpoints
3. Matches user intent (route under /stories for story debates)
4. Consistent with argument endpoints which use `/api/debates/:debateId/args` (not nested under /stories)

---

## Files to Modify

1. **backend/src/routes/engagement.routes.js** (line 53)
   - Change: `router.get('/debates/:debateId', ...)`
   - To: `router.get('/:debateId', ...)`

That's the ONLY change needed to fix the routing mismatch.

