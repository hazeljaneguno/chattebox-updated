import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import express from 'express';
import User from '../src/models/User.js';
import Group from '../src/models/Group.js';
import GroupCall from '../src/models/GroupCall.js';
import Call from '../src/models/Call.js';
import { requireAuth } from '../src/middleware/requireAuth.js';
import actions from '../src/routes/callActions.js';
import tokens from '../src/routes/groupCalls.js';
import { RoomServiceClient } from 'livekit-server-sdk';
import { normalizeApiUrl } from '../../client/src/apiConfig.js';
import { registerGroupCallJoin } from '../src/sockets/groupCall/groupCallJoin.js';
const uid='111111111111111111111111', gid='222222222222222222222222', cid='333333333333333333333333';
const bearer=jwt.sign({userId:uid},process.env.JWT_SECRET);
User.findById=()=>({select:async()=>({_id:uid,username:'Tester',fcmTokens:[]})});
const app=express(); app.use(express.json());
const events=[]; app.set('io',{to:()=>({emit:(...args)=>events.push(args)})});
app.use('/actions',actions); app.use('/tokens',tokens);
const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`;
const post=(path,body={},token=bearer)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
test.after(()=>server.close());
test('API URL accepts one origin, strips /api, rejects the reported comma URL',()=>{
 assert.equal(normalizeApiUrl('https://api.example.com/api/'),'https://api.example.com');
 for(const url of ['http://localhost:5173,https://api.example.com','javascript:alert(1)','https://u:p@example.com']) assert.throws(()=>normalizeApiUrl(url));
});
test('native HTTP actions reject missing and invalid credentials',async()=>{
 assert.equal((await post(`/actions/${cid}/decline`,{},'')).status,401);
 assert.equal((await post(`/actions/${cid}/decline`,{},'bad')).status,401);
});
test('private decline scopes atomic update to receiver and ringing non-expired state',async()=>{
 let query; Call.findOneAndUpdate=async(q)=>{query=q;return {caller:gid};};
 assert.equal((await post(`/actions/${cid}/decline`)).status,200);
 assert.equal(query.receiver,uid); assert.equal(query.status,'ringing'); assert.ok(query.expiresAt.$gt instanceof Date);
 assert.ok(events.some(e=>e[0]==='call:declined'));
});
test('group decline rejects non-members without changing call state',async()=>{
 Group.findOne=async()=>null; let changed=false; GroupCall.updateOne=async()=>{changed=true};
 assert.equal((await post(`/actions/${cid}/decline`,{groupId:gid})).status,403); assert.equal(changed,false);
});
test('group token permits second participant; rejects full rooms and ended calls',async()=>{
 Group.findOne=()=>({select:async()=>({_id:gid,name:'Friends'})});
 let ended=false, peers=1;
 GroupCall.findOne=async()=>ended?null:{_id:cid,host:gid,roomName:'test',callType:'video',maxParticipants:10,invitations:[{user:uid,status:'accepted'}]};
 RoomServiceClient.prototype.listRooms=async()=>[{name:'test'}];
 RoomServiceClient.prototype.listParticipants=async()=>Array.from({length:peers},(_,i)=>({identity:`other-${i}`}));
 let response=await post(`/tokens/${gid}/token`,{callId:cid});
 assert.equal(response.status,200); assert.equal((await response.json()).maxParticipants,10);
 peers=10; assert.equal((await post(`/tokens/${gid}/token`,{callId:cid})).status,409);
 ended=true; assert.equal((await post(`/tokens/${gid}/token`,{callId:cid})).status,404);
});
test('group socket join rejects outsiders before querying media server',async()=>{
 Group.findOne=()=>({select:async()=>null});
 const handlers={}; registerGroupCallJoin({}, {on:(name,fn)=>handlers[name]=fn},uid);
 let response; await handlers['group-call:join']({groupId:gid,callId:cid},r=>response=r);
 assert.equal(response.ok,false); assert.match(response.message,/member/);
});
test('maintenance marks missed invitations and ends empty rooms after grace',async()=>{
 const { reconcileCalls } = await import('../src/services/callMaintenance.js');
 Call.find=async()=>[];
 let saved=0,deleted=0;
 const invitation={user:uid,status:'pending',expiresAt:new Date(Date.now()-1000)};
 const call={_id:cid,group:gid,host:uid,roomName:'room',callType:'audio',status:'active',startedAt:new Date(),invitations:[invitation],save:async()=>saved++};
 GroupCall.find=async()=>[call]; Group.findById=async()=>({_id:gid,name:'Friends',members:[uid,gid]});
 RoomServiceClient.prototype.listRooms=async()=>[{name:'room'}];
 RoomServiceClient.prototype.listParticipants=async()=>[];
 RoomServiceClient.prototype.deleteRoom=async()=>deleted++;
 const emitted=[];const io={to:()=>({emit:(...args)=>emitted.push(args)})};
 await reconcileCalls(io);assert.equal(invitation.status,'missed');assert.equal(call.status,'active');
 call.startedAt=new Date(Date.now()-100000);
 await reconcileCalls(io);assert.equal(call.status,'ended');assert.equal(deleted,1);assert.equal(saved,2);
 assert.equal(emitted.filter(e=>e[0]==='group-call:ended').length,2);
});
