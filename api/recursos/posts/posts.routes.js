const express = require('express');
const uuidv4 = require('uuid/v4');
const passport = require('passport');

const { validarMetadataDePost, validarImagen } = require('./posts.validate');
const log = require('../../../utils/logger');
const {
  obtenerPosts,
  obtenerPost,
  crearPost,
  guardarImagen,
  obtenerPostsParaUsuario,
  obtenerFeed,
  borrarPost
} = require('./posts.controller');
const procesarErrores = require('../../libs/errorHandler').procesarErrores;
const { validarId } = require('../../libs/mongoUtils');

const jwtAuthenticate = passport.authenticate('jwt', { session: false });
const postsRouter = express.Router();

postsRouter.get(
  '/',
  procesarErrores((req, res) => {
    return obtenerPosts().then(posts => {
      res.json(posts);
    });
  })
);

postsRouter.get(
  '/explore',
  procesarErrores((req, res) => {
    return obtenerPosts().then(posts => {
      res.json(posts);
    });
  })
);

postsRouter.get(
  '/feed',
  [jwtAuthenticate],
  procesarErrores((req, res) => {
    const buscarAntesDeFecha = req.query.fecha || new Date();
    log.info(
      `Buscando posts para el feed antes de la fecha [${buscarAntesDeFecha}]`
    );
    return obtenerFeed(req.user.id, buscarAntesDeFecha).then(posts => {
      res.json(posts);
    });
  })
);

postsRouter.get(
  '/usuario/:id',
  [validarId, jwtAuthenticate],
  procesarErrores((req, res) => {
    let id = req.params.id;
    return obtenerPostsParaUsuario(id).then(posts => {
      res.json(posts);
    });
  })
);

postsRouter.get(
  '/:id',
  [jwtAuthenticate, validarId],
  procesarErrores((req, res) => {
    let id = req.params.id;
    return obtenerPost(id, req.user.id).then(post => {
      if (!post) {
        let err = new Error(`Post con id [${id}] no existe.`);
        err.status = 404;
        throw err;
      }
      res.json(post);
    });
  })
);

postsRouter.post(
  '/',
  [jwtAuthenticate, validarMetadataDePost],
  procesarErrores((req, res) => {
    return crearPost(req.body, req.user.id).then(post => {
      log.info('Post agregada a la colección de posts', post);
      res.status(201).json(post);
    });
  })
);

postsRouter.post(
  '/upload',
  [jwtAuthenticate, validarImagen],
  procesarErrores(async (req, res) => {
    const usuario = req.user.username;
    log.info(`Request recibido de usuario [${usuario}] para subir imagen`);

    const nombreRandomizado = `${uuidv4()}.${req.extensionDeArchivo}`;
    const urlDeImagen = await guardarImagen(req.body, nombreRandomizado);

    log.info(
      `Link a nueva imagen [${urlDeImagen}]. Subida por dueño [${usuario}]`
    );
    res.json({ url: urlDeImagen });
  })
);
postsRouter.delete('/:id', [jwtAuthenticate, validarId], async (req, res) => {
  let id = req.params.id
  let usuarioautenticado = req.user._id
  let postaborrar

  try {
    postaborrar = await obtenerPost(id, usuarioautenticado)
  } catch (err) {
    log.error(`Excepcion al borrar post con id [${id}]`, err)
    res.status(500).send(`Excepcion al borrar post con id [${id}]`)
    return
  }
  
  if (!postaborrar){
    log.info(`post con id [${id}] no existe. Nada que borrar`)
    res.status(404).send(`post con id [${id}] no existe. Nada que borrar`)
    return
  }
  var iddelpost = String(postaborrar.usuario._id)
  var iddelusuario = String(usuarioautenticado)
  let essuyo
  if (iddelpost !== iddelusuario){
    essuyo = false
  } else {
    essuyo = true
  }


  if (!essuyo) {
    log.info(`Usuario ${usuarioautenticado} no es dueno del post ${id}. Dueno real es ${postaborrar.usuario._id}. request no sera procesado`)
    res.status(401).send(`No eres dueno del post ${id}. Solo puedes borrar los tuyos, tu eres [${iddelusuario}] y el dueño es [${iddelpost}]`)
    return
  }

  try {
    let postBorrado = await borrarPost(id)
    log.info(`post con id ${id} fue borrado`)
    res.json(postBorrado)
  } catch (err) {
    res.status(500).send(`Error ocurrio borrando post con id ${id}`)
  }
})

module.exports = postsRouter;
