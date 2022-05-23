import http from "http";
// import SocketIO from "socket.io";
import {Server} from "socket.io"
import express from "express";
import{ instrument } from "@socket.io/admin-ui" //어드민 유 아이 쓰기위해서!

const app = express();

app.set("view engine", "pug");//pug 페이지 랜더링 하기
app.set("views", __dirname + "/views");//페이지 보여주기
app.use("/public", express.static(__dirname + "/public")); //페이지에 스태틱 작업하기 => app.js에 있는 내용 브라우저에서 보여줌(pug에서 app.js로 설정했음) =>유저가 볼 수 있는 내용 
app.get("/",(_,res)=>res.render("home") )//home 랜더링
app.get("/*", (_, res) => res.redirect("/"));//유저가 뒷부분을 잘못 쳤을 떄 홈으로 리다이렉트




const httpServer = http.createServer(app);
// const wsServer = SocketIO(httpServer); //웹소켓 서버 + http서버 같은 포트 에서 둘다 돌리기
const wsServer = new Server(httpServer,{
  cors:{
    origin:["http://admin.socket.io"],
    credentials:true,
  }
})
instrument(wsServer,{
  auth:false //비밀번호 설정해 줄 수도 있음
})

function publicRooms(){//방이름 가져오기
  const {sockets:{
    adapter:{sids,rooms},
  }} = wsServer
  const publicRooms = []
  rooms.forEach((_,key) =>{
    if(sids.get(key) === undefined){
      publicRooms.push(key)
    }
  })
  return publicRooms
}
function countRoom(roomName){ //룸안에 몇명 있나 확인 
  return wsServer.sockets.adapter.rooms.get(roomName)?.size
}

wsServer.on("connection",(socket)=>{
  socket["nickname"] = "Anonymous" //익명으로 닉네임 지정
  socket.onAny((event)=>{
    console.log(`socket event:${event}`)
    console.log(wsServer.sockets.adapter)
  })//socket에 들어온 데이터 =>백엔드에서 emit 해준 것
  socket.on("enter_room",(roomName,done)=>{
    console.log(socket.id)
    console.log(socket.rooms)//소켓아이디랑 같음
    socket.join(roomName)//이름이 roomName인 룸에 참가
    console.log(socket.rooms)//이제는 소켓아이디, 룸 이름
    done();//함수 실행시키는 스위치라고 생각 
    socket.to(roomName).emit("welcome",socket.nickname,countRoom(roomName))//그 룸 안에 있는 사람 모두에게 welcome보내기
    wsServer.sockets.emit("room_change",publicRooms());//모든 룸 안에 있는 사람에게 roomchange 메세지 보내기
  })
  socket.on("disconnecting", () => {
    socket.rooms.forEach((room) =>
      socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1)
    );
  });
  socket.on("disconnect",()=>{//룸이 없어졌을 떄 해야 하기에 disconnect 쓴다
    wsServer.sockets.emit("room_change",publicRooms());//모든 룸 안에 있는 사람에게 roomchange 메세지 보내기
  })
  socket.on("new_message",(msg,room,done)=>{
    socket.to(room).emit("new_message",`${socket.nickname}: ${msg}`)
    done()
  })
  socket.on("nickname",(nickname)=>(socket["nickname"]=nickname))//닉네임 등록
})

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);
