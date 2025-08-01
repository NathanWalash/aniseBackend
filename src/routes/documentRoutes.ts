import { Router } from 'express';
import { 
  listDocuments, 
  listPendingDocuments, 
  listExecutedDocuments, 
  getDocument, 
  createDocument, 
  signDocument 
} from '../controllers/documentController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = Router();

// Protected routes - require authentication
router.use(verifyFirebaseToken);

// GET /api/daos/:daoAddress/documents - List all documents (PAGINATED)
router.get('/:daoAddress/documents', listDocuments);

// GET /api/daos/:daoAddress/documents/pending - List pending documents
router.get('/:daoAddress/documents/pending', listPendingDocuments);

// GET /api/daos/:daoAddress/documents/executed - List executed documents
router.get('/:daoAddress/documents/executed', listExecutedDocuments);

// GET /api/daos/:daoAddress/documents/:documentId - Get specific document
router.get('/:daoAddress/documents/:documentId', getDocument);

// POST /api/daos/:daoAddress/documents - Create new document
router.post('/:daoAddress/documents', createDocument);

// POST /api/daos/:daoAddress/documents/:documentId/sign - Sign document
router.post('/:daoAddress/documents/:documentId/sign', signDocument);

export default router; 