import { Request, Response } from 'express';
import admin from '../firebaseAdmin';
import { verifyTransaction } from '../utils/verifyTransaction';
import MemberModuleAbiJson from '../abis/MemberModule.json';
import { ethers } from 'ethers';

const db = admin.firestore();
const MemberModuleAbi = MemberModuleAbiJson.abi || MemberModuleAbiJson;

// GET /api/daos/:daoAddress/members - List all members
// Returns all members (role, joinedAt, uid) from 'daos/{daoAddress}/members'.
export const listMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const snapshot = await db.collection('daos').doc(daoAddress).collection('members').get();
    const members = snapshot.docs.map(doc => ({ walletAddress: doc.id, ...doc.data() }));
    res.json({ members, memberCount: members.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/members/:memberAddress - Member profile/role in DAO
// Returns a single member's profile/role from 'daos/{daoAddress}/members/{walletAddress}'.
export const getMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress, memberAddress } = req.params;
    const doc = await db.collection('daos').doc(daoAddress).collection('members').doc(memberAddress).get();
    if (!doc.exists) {
      // Check if they have a pending join request
      const joinRequestDoc = await db.collection('daos').doc(daoAddress).collection('joinRequests').doc(memberAddress).get();
      if (joinRequestDoc.exists && joinRequestDoc.data()?.status === 'pending') {
        res.json({ status: 'pending_request' });
      } else {
        res.json({ status: 'not_member' });
      }
      return;
    }
    res.json({ status: 'member', walletAddress: doc.id, ...doc.data() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/join-requests - List pending join requests
// Returns pending join requests (status, uid, timestamps) from 'daos/{daoAddress}/joinRequests'.
export const listJoinRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    // Only get pending requests
    const snapshot = await db.collection('daos')
      .doc(daoAddress)
      .collection('joinRequests')
      .where('status', '==', 'pending')
      .get();
    
    // Get join requests with user details
    const joinRequestsPromises = snapshot.docs.map(async doc => {
      const data = doc.data();
      let userDetails = null;
      
      // If we have a uid, fetch user details
      if (data.uid) {
        const userDoc = await db.collection('users').doc(data.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userDetails = {
            firstName: userData?.firstName,
            lastName: userData?.lastName
          };
        }
      }
      
      return {
        memberAddress: doc.id,
        ...data,
        userDetails
      };
    });

    const joinRequests = await Promise.all(joinRequestsPromises);
    res.json({ joinRequests });
  } catch (err: any) {
    console.error('Error in listJoinRequests:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/daos/:daoAddress/join-requests/:memberAddress - Get single join request
export const getJoinRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress, memberAddress } = req.params;
    
    const docRef = db.collection('daos').doc(daoAddress).collection('joinRequests').doc(memberAddress);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      res.status(404).json({ error: 'Join request not found' });
      return;
    }
    
    res.json({ ...docSnap.data(), memberAddress: docSnap.id });
  } catch (err: any) {
    console.error('Error in getJoinRequest:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/daos/:daoAddress/join-requests - Request to join DAO
// Frontend: User submits a join request after connecting wallet. Backend creates a joinRequest doc with status 'pending'.
export const requestJoin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress } = req.params;
    const { txHash, memberAddress } = req.body;

    console.log('Received join request:', { daoAddress, txHash, memberAddress });

    if (!txHash || !memberAddress) {
      res.status(400).json({ error: 'Missing txHash or memberAddress' });
      return;
    }

    // Get user's UID from auth context
    const uid = (req as any).user?.uid;
    console.log('User UID:', uid);

    // Check if already a member
    const memberDoc = await db.collection('daos').doc(daoAddress).collection('members').doc(memberAddress).get();
    if (memberDoc.exists) {
      console.log('User is already a member');
      res.status(400).json({ error: 'Already a member' });
      return;
    }

    // Check if already has a pending request
    const requestDoc = await db.collection('daos').doc(daoAddress).collection('joinRequests').doc(memberAddress).get();
    if (requestDoc.exists) {
      const data = requestDoc.data();
      if (data?.status === 'pending') {
        console.log('User already has a pending request');
        res.status(400).json({ error: 'Already requested to join' });
        return;
      }
    }

    // Store join request
    const requestData = {
      status: 'pending',
      uid: uid || null, // Make uid optional
      txHash,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      memberAddress // Store this to make queries easier
    };
    console.log('Storing join request:', requestData);

    await db.collection('daos').doc(daoAddress).collection('joinRequests').doc(memberAddress).set(requestData);
    console.log('Join request stored successfully');

    res.json({ status: 'success', data: requestData });
  } catch (err: any) {
    console.error('Error in requestJoin:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/daos/:daoAddress/join-requests/:requestId/approve - Approve join request (admin)
// Frontend: Admin approves a join request. Backend verifies tx, updates joinRequest status to 'approved', and adds member.
export const approveJoinRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress, requestId: memberAddress } = req.params;
    const { txHash } = req.body;

    if (!txHash) {
      res.status(400).json({ error: 'Missing txHash' });
      return;
    }

    // 1. Verify the admin is making this request
    const adminAddress = (req as any).user?.wallet?.address;
    if (!adminAddress) {
      res.status(401).json({ error: 'Admin wallet not found' });
      return;
    }

    // Convert addresses to checksum format
    const checksumAdminAddress = ethers.getAddress(adminAddress);
    const checksumMemberAddress = ethers.getAddress(memberAddress);
    // Also keep lowercase version for Firestore lookups
    const lowercaseMemberAddress = memberAddress.toLowerCase();

    console.log('[approveJoinRequest] Using addresses:', {
      admin: checksumAdminAddress,
      member: checksumMemberAddress,
      memberLower: lowercaseMemberAddress
    });

    const adminDoc = await db.collection('daos').doc(daoAddress).collection('members').doc(checksumAdminAddress).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'Admin') {
      console.log('[approveJoinRequest] Not an admin:', {
        exists: adminDoc.exists,
        role: adminDoc.data()?.role
      });
      res.status(403).json({ error: 'Not an admin' });
      return;
    }

    // 2. Get the join request to verify it exists and get the user's UID
    // Try both lowercase and checksum versions
    let requestDoc = await db.collection('daos').doc(daoAddress).collection('joinRequests').doc(lowercaseMemberAddress).get();
    if (!requestDoc.exists) {
      // Try checksum version as fallback
      requestDoc = await db.collection('daos').doc(daoAddress).collection('joinRequests').doc(checksumMemberAddress).get();
    }

    console.log('[approveJoinRequest] Join request lookup:', {
      exists: requestDoc.exists,
      status: requestDoc.data()?.status,
      address: requestDoc.id
    });

    if (!requestDoc.exists || requestDoc.data()?.status !== 'pending') {
      res.status(404).json({ error: 'Join request not found or not pending' });
      return;
    }

    const requestData = requestDoc.data();
    const uid = requestData?.uid;

    // 3. Verify the transaction and check for MemberAdded event
    console.log('Verifying transaction:', txHash);
    const receipt = await verifyTransaction({
      txHash,
      expectedEventSig: 'MemberAdded(address,uint8)',
      abi: MemberModuleAbi
    });

    // 4. Verify the event args match our expected member
    if (ethers.getAddress(receipt.member) !== checksumMemberAddress) {
      throw new Error('Transaction member address mismatch');
    }

    // 5. Update join request status
    await requestDoc.ref.update({
      status: 'approved',
      handledAt: admin.firestore.FieldValue.serverTimestamp(),
      handledBy: checksumAdminAddress,
      handledTx: txHash
    });

    // 6. Add member to members collection
    await db.collection('daos').doc(daoAddress).collection('members').doc(checksumMemberAddress).set({
      role: 'Member',
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      uid: uid || null,
      approvedBy: checksumAdminAddress,
      approvalTx: txHash
    });

    // 7. If we have a UID, update the user's daos array
    if (uid) {
      await db.collection('users').doc(uid).update({
        daos: admin.firestore.FieldValue.arrayUnion(daoAddress)
      });
    }

    console.log('Successfully approved join request for:', checksumMemberAddress);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error in approveJoinRequest:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/daos/:daoAddress/join-requests/:requestId/reject - Reject join request (admin)
// Frontend: Admin rejects a join request. Backend verifies tx, updates joinRequest status to 'rejected'.
export const rejectJoinRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { daoAddress, requestId: memberAddress } = req.params;
    const { txHash } = req.body;

    if (!txHash) {
      res.status(400).json({ error: 'Missing txHash' });
      return;
    }

    // 1. Verify the admin is making this request
    const adminAddress = (req as any).user?.wallet?.address;
    if (!adminAddress) {
      res.status(401).json({ error: 'Admin wallet not found' });
      return;
    }

    // Convert addresses to checksum format
    const checksumAdminAddress = ethers.getAddress(adminAddress);
    const checksumMemberAddress = ethers.getAddress(memberAddress);
    // Also keep lowercase version for Firestore lookups
    const lowercaseMemberAddress = memberAddress.toLowerCase();

    console.log('[rejectJoinRequest] Using addresses:', {
      admin: checksumAdminAddress,
      member: checksumMemberAddress,
      memberLower: lowercaseMemberAddress
    });

    const adminDoc = await db.collection('daos').doc(daoAddress).collection('members').doc(checksumAdminAddress).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'Admin') {
      console.log('[rejectJoinRequest] Not an admin:', {
        exists: adminDoc.exists,
        role: adminDoc.data()?.role
      });
      res.status(403).json({ error: 'Not an admin' });
      return;
    }

    // 2. Get the join request to verify it exists and get the user's UID
    // Try both lowercase and checksum versions
    let requestDoc = await db.collection('daos').doc(daoAddress).collection('joinRequests').doc(lowercaseMemberAddress).get();
    if (!requestDoc.exists) {
      // Try checksum version as fallback
      requestDoc = await db.collection('daos').doc(daoAddress).collection('joinRequests').doc(checksumMemberAddress).get();
    }

    console.log('[rejectJoinRequest] Join request lookup:', {
      exists: requestDoc.exists,
      status: requestDoc.data()?.status,
      address: requestDoc.id
    });

    if (!requestDoc.exists || requestDoc.data()?.status !== 'pending') {
      res.status(404).json({ error: 'Join request not found or not pending' });
      return;
    }

    // 3. Verify the transaction and check for JoinRequestHandled event
    console.log('Verifying transaction:', txHash);
    const receipt = await verifyTransaction({
      txHash,
      expectedEventSig: 'JoinRequestHandled(address,bool)',
      abi: MemberModuleAbi
    });

    // 4. Verify the event args match our expected member and rejection status
    if (ethers.getAddress(receipt.requester) !== checksumMemberAddress || receipt.accepted !== false) {
      throw new Error('Transaction member address mismatch or wrong acceptance status');
    }

    // 5. Update join request status
    await requestDoc.ref.update({
      status: 'rejected',
      handledAt: admin.firestore.FieldValue.serverTimestamp(),
      handledBy: checksumAdminAddress,
      handledTx: txHash
    });

    console.log('Successfully rejected join request for:', checksumMemberAddress);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error in rejectJoinRequest:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/daos/:daoAddress/members/:memberAddress/role - Change member role (admin only)
// Frontend: Admin changes a member's role. Backend updates the member doc's role field.
export const changeMemberRole = async (req: Request, res: Response): Promise<void> => {
  // TODO: Validate admin, update 'role' field in 'members' subcollection
  res.status(501).json({ error: 'Not implemented' });
};

// POST /api/daos/:daoAddress/members/:memberAddress/remove - Remove member (admin only)
// Frontend: Admin removes a member. Backend deletes or updates the member doc.
export const removeMember = async (req: Request, res: Response): Promise<void> => {
  // TODO: Validate admin, remove member from 'members' subcollection
  res.status(501).json({ error: 'Not implemented' });
}; 