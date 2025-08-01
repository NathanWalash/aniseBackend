import { Request, Response } from 'express';
import admin from 'firebase-admin';
import { verifyTransaction } from '../utils/verifyTransaction';
import { ethers } from 'ethers';
import TaskManagementModuleAbi from '../abis/TaskManagementModule.json';

const db = admin.firestore();
const AMOY_RPC_URL = 'https://polygon-amoy.infura.io/v3/e3899c2e9571490db9a718222ccf6649';

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    wallet?: {
      address: string;
    };
  };
}

interface Task {
  taskId: string;
  title: string;
  description: string;
  creator: string;
  createdBy: string;
  status: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate: {
    _seconds: number;
    _nanoseconds: number;
  };
  createdAt: {
    _seconds: number;
    _nanoseconds: number;
  };
  updatedAt: {
    _seconds: number;
    _nanoseconds: number;
  };
  txHash: string;
}

// GET /api/daos/:daoAddress/tasks - List all tasks (PAGINATED)
export const listTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Use Firestore subcollection pattern with pagination
    const snapshot = await db.collection('daos')
      .doc(daoAddress)
      .collection('tasks')
      .orderBy('createdAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();
    
    // Get total count
    const totalSnapshot = await db.collection('daos')
      .doc(daoAddress)
      .collection('tasks')
      .count()
      .get();
    
    // Map with ID included
    const tasks = snapshot.docs.map(doc => ({
      taskId: doc.id,
      ...doc.data()
    }));

    // Always wrap in named field
    res.json({ tasks });
  } catch (err: any) {
    console.error('Error in listTasks:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/tasks/:taskId - Get specific task
export const getTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress, taskId } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('tasks').doc(taskId).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    
    res.json({ taskId: doc.id, ...doc.data() });
  } catch (err: any) {
    console.error('Error in getTask:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/daos/:daoAddress/tasks - Create new task
export const createTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const { title, description, priority, dueDate, txHash } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // 1. Get the transaction receipt for sender verification
    const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error('Transaction not found');
    }
    if (receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    // 2. Get the event args
    const eventArgs = await verifyTransaction({
      txHash,
      expectedEventSig: 'TaskCreated(uint256,string,address)',
      abi: TaskManagementModuleAbi.abi
    });

    // 3. Extract data from event args (returned in order of parameters)
    const taskId = eventArgs[0].toString();  // uint256 taskId
    const eventTitle = eventArgs[1];         // string title
    const creator = eventArgs[2];            // address creator

    // 4. Verify the event data matches the request
    if (title !== eventTitle) {
      throw new Error('Event data mismatch with request');
    }

    // 5. Create the task document in Firestore
    const docRef = db.collection('daos')
      .doc(daoAddress)
      .collection('tasks')
      .doc(taskId);

    await docRef.set({
      taskId: Number(taskId),
      creator,
      createdBy: userId, // Add the user UID
      title: eventTitle,
      description,
      status: 'BACKLOG',
      priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'][priority],
      dueDate: admin.firestore.Timestamp.fromMillis(dueDate * 1000),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      txHash
    });

    res.json({ 
      taskId: taskId.toString(), 
      task: { taskId: taskId.toString(), creator, createdBy: userId, title: eventTitle, description, status: 'BACKLOG', priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'][priority], dueDate: admin.firestore.Timestamp.fromMillis(dueDate * 1000), createdAt: admin.firestore.Timestamp.now(), updatedAt: admin.firestore.Timestamp.now(), txHash }
    });
  } catch (err: any) {
    console.error('Error in createTask:', err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/daos/:daoAddress/tasks/:taskId/status - Update task status
export const updateTaskStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress, taskId } = req.params;
    const { newStatus, txHash } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // 1. Verify the transaction on blockchain
    const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error('Transaction not found');
    }
    if (receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    // 2. Update Firestore
    const statusMap = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    const status = statusMap[newStatus] as Task['status'];
    
    await db.collection('daos')
      .doc(daoAddress)
      .collection('tasks')
      .doc(taskId)
      .update({
        status: status,
        updatedAt: admin.firestore.Timestamp.now()
      });

    // 3. Get updated task
    const doc = await db.collection('daos')
      .doc(daoAddress)
      .collection('tasks')
      .doc(taskId)
      .get();

    res.json({ task: { taskId: doc.id, ...doc.data() } });
  } catch (err: any) {
    console.error('Error in updateTaskStatus:', err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/daos/:daoAddress/tasks/:taskId - Update task details
export const updateTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress, taskId } = req.params;
    const { title, description, priority, dueDate, txHash } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // 1. Verify the transaction on blockchain
    const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error('Transaction not found');
    }
    if (receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    // 2. Update Firestore
    const priorityMap = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const newPriority = priorityMap[priority] as Task['priority'];
    
    await db.collection('daos')
      .doc(daoAddress)
      .collection('tasks')
      .doc(taskId)
      .update({
        title,
        description,
        priority: newPriority,
        dueDate: admin.firestore.Timestamp.fromMillis(dueDate * 1000),
        updatedAt: admin.firestore.Timestamp.now()
      });

    // 3. Get updated task
    const doc = await db.collection('daos')
      .doc(daoAddress)
      .collection('tasks')
      .doc(taskId)
      .get();

    res.json({ task: { taskId: doc.id, ...doc.data() } });
  } catch (err: any) {
    console.error('Error in updateTask:', err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/daos/:daoAddress/tasks/:taskId - Delete task
export const deleteTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { daoAddress, taskId } = req.params;
    const { txHash } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // 1. Verify the transaction on blockchain
    const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error('Transaction not found');
    }
    if (receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    // 2. Delete from Firestore
    await db.collection('daos')
      .doc(daoAddress)
      .collection('tasks')
      .doc(taskId)
      .delete();

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error in deleteTask:', err);
    res.status(500).json({ error: err.message });
  }
}; 