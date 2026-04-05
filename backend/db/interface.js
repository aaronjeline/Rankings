/**
 * Store interface — document the contract any DB implementation must satisfy.
 *
 * All methods may be async (implementations should return Promises or plain values).
 *
 * createUser(username, passwordHash)
 *   → { id, username }                      throws on duplicate username
 *
 * getUserByUsername(username)
 *   → { id, username, password_hash } | null
 *
 * listUsers()
 *   → [{ username, created_at }]            sorted by username
 *
 * getRankingsByUserId(userId)
 *   → [{ id, text, position }]              sorted by position ASC
 *
 * getUserByUsername(username)
 *   → { id, username, password_hash } | null
 *
 * addRankingItem(userId, text)
 *   → { id, text, position }
 *
 * getRankingItem(id, userId)
 *   → { id, text, position, user_id } | null   returns null if not found or not owned
 *
 * deleteItem(id, userId)
 *   → void                                  also renumbers remaining items
 *
 * getOwnedItemIds(userId)
 *   → [id]
 *
 * reorderItems(userId, ids)
 *   → void                                  sets position = array index for each id
 */

// This file is documentation only — no runtime code.
