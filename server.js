// Servidor
const io = require('socket.io')(server)
const rooms = {} // Para almacenar las salas y sus usuarios

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id)

  socket.on('join', (roomId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = []
    }

    if (rooms[roomId].length >= 2) { // Por ejemplo, limitando a 2 usuarios por sala
      socket.emit('full_room')
      return
    }

    socket.join(roomId)
    rooms[roomId].push(socket.id)

    if (rooms[roomId].length === 1) {
      socket.emit('room_created')
    } else {
      io.to(roomId).emit('room_joined')
    }

    socket.on('start_call', () => {
      socket.broadcast.to(roomId).emit('start_call')
    })

    socket.on('webrtc_offer', (data) => {
      socket.broadcast.to(data.roomId).emit('webrtc_offer', {
        userId: socket.id,
        sdp: data.sdp
      })
    })

    socket.on('webrtc_answer', (data) => {
      socket.broadcast.to(data.roomId).emit('webrtc_answer', {
        userId: socket.id,
        sdp: data.sdp
      })
    })

    socket.on('webrtc_ice_candidate', (data) => {
      socket.broadcast.to(data.roomId).emit('webrtc_ice_candidate', {
        userId: socket.id,
        candidate: data.candidate
      })
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
      // Eliminar el usuario de la sala y notificar a los demás usuarios
      Object.keys(rooms).forEach(roomId => {
        rooms[roomId] = rooms[roomId].filter(id => id !== socket.id)
        if (rooms[roomId].length === 0) {
          delete rooms[roomId]
        }
      })
      io.emit('user_disconnected', { userId: socket.id })
    })
  })
})
