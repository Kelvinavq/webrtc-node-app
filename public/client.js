// DOM elements.
const roomSelectionContainer = document.getElementById('room-selection-container')
const roomInput = document.getElementById('room-input')
const connectButton = document.getElementById('connect-button')

const videoChatContainer = document.getElementById('video-chat-container')
const localVideoComponent = document.getElementById('local-video')
const remoteVideosContainer = document.createElement('div')
videoChatContainer.appendChild(remoteVideosContainer)

// Variables.
const socket = io()

const mediaConstraints = {
  audio: true,
  video: { width: 1280, height: 720 },
}
let localStream
let peerConnections = {} // Almacenar conexiones de pares
let roomId

// Free public STUN servers provided by Google.
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
}

// BUTTON LISTENER ============================================================
connectButton.addEventListener('click', async () => {
  if (roomInput.value) {
    await setLocalStream(mediaConstraints) // Asegúrate de que esto se complete
    joinRoom(roomInput.value) // Luego, llama a joinRoom
  } else {
    alert('Please type a room ID')
  }
})


// SOCKET EVENT CALLBACKS =====================================================
socket.on('room_created', async () => {
  console.log('Socket event callback: room_created')
  await setLocalStream(mediaConstraints)
  videoChatContainer.style.display = 'block'
  roomSelectionContainer.style.display = 'none'
})


socket.on('room_joined', async () => {
  console.log('Socket event callback: room_joined')
  await setLocalStream(mediaConstraints)
  console.log('Local stream set:', localStream)
  socket.emit('start_call', roomId)
})


socket.on('full_room', () => {
  console.log('Socket event callback: full_room')
  alert('The room is full, please try another one')
})

socket.on('new_user_joined', async (event) => {
  console.log('New user joined:', event)
  // Crear una conexión de pares para el nuevo usuario
  await createPeerConnection(event.userId)
})

socket.on('user_disconnected', (event) => {
  console.log('User disconnected:', event.userId)
  // Manejar la desconexión del usuario (eliminar su video, etc.)
  const remoteVideo = document.getElementById(event.userId)
  if (remoteVideo) {
    remoteVideo.remove()
  }
  if (peerConnections[event.userId]) {
    peerConnections[event.userId].close()
    delete peerConnections[event.userId]
  }
})

socket.on('start_call', async () => {
  console.log('Socket event callback: start_call')
  await createPeerConnection()
})

socket.on('webrtc_offer', async (event) => {
  console.log('Received webrtc_offer:', event)
  const { userId } = event
  if (!peerConnections[userId]) {
    await createPeerConnection(userId)
  }
  const rtcPeerConnection = peerConnections[userId]
  rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event.sdp))
  await createAnswer(rtcPeerConnection, userId)
})

socket.on('webrtc_answer', (event) => {
  console.log('Received webrtc_answer:', event)
  const { userId } = event
  peerConnections[userId].setRemoteDescription(new RTCSessionDescription(event.sdp))
})


socket.on('webrtc_ice_candidate', (event) => {
  console.log('Received webrtc_ice_candidate:', event)
  const { userId, candidate } = event
  if (peerConnections[userId]) {
    const rtcIceCandidate = new RTCIceCandidate(candidate)
    peerConnections[userId].addIceCandidate(rtcIceCandidate)
  }
})


async function createPeerConnection(userId) {
  const rtcPeerConnection = new RTCPeerConnection(iceServers)
  peerConnections[userId] = rtcPeerConnection

  rtcPeerConnection.ontrack = (event) => {
    const remoteStream = event.streams[0]
    if (remoteStream) {
      let remoteVideo = document.getElementById(userId)
      if (!remoteVideo) {
        remoteVideo = document.createElement('video')
        remoteVideo.id = userId
        remoteVideo.autoplay = true
        remoteVideo.playsInline = true
        remoteVideosContainer.appendChild(remoteVideo)
      }
      remoteVideo.srcObject = remoteStream
    } else {
      console.error('No remote stream found in ontrack event')
    }
  }

  rtcPeerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('webrtc_ice_candidate', {
        userId,
        candidate: event.candidate,
        roomId
      })
    }
  }

  // Asegúrate de que localStream esté disponible antes de agregar pistas
  if (localStream) {
    addLocalTracks(rtcPeerConnection)
  } else {
    console.error('Local stream is not available at createPeerConnection')
  }
  
  return rtcPeerConnection
}



async function addLocalTracks(rtcPeerConnection) {
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      rtcPeerConnection.addTrack(track, localStream)
    })
  } else {
    console.error('Local stream is not available')
  }
}


async function createOffer(rtcPeerConnection, userId) {
  try {
    const sessionDescription = await rtcPeerConnection.createOffer()
    await rtcPeerConnection.setLocalDescription(sessionDescription)
    socket.emit('webrtc_offer', { type: 'webrtc_offer', sdp: sessionDescription, roomId, userId })
  } catch (error) {
    console.error('Error creating offer:', error)
  }
}

async function createAnswer(rtcPeerConnection, userId) {
  try {
    const sessionDescription = await rtcPeerConnection.createAnswer()
    await rtcPeerConnection.setLocalDescription(sessionDescription)
    socket.emit('webrtc_answer', { type: 'webrtc_answer', sdp: sessionDescription, roomId, userId })
  } catch (error) {
    console.error('Error creating answer:', error)
  }
}


async function setLocalStream(mediaConstraints) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
    localVideoComponent.srcObject = localStream
    console.log('Local stream set successfully:', localStream)
  } catch (error) {
    console.error('Could not get user media', error)
  }
}




function joinRoom(room) {
  if (room === '') {
    alert('Please type a room ID')
  } else {
    roomId = room
    socket.emit('join', roomId)
  }
}
