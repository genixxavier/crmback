const Usuario = require("../models/Usuario");
const Producto = require("../models/Producto");
const Cliente = require("../models/Cliente");
const Pedido = require("../models/Pedido");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "variables.env" });

//crear token
const crearToken = (usuario, secreta, expiresIn) => {
    const { id, nombre, email, apellido } = usuario;

    return jwt.sign({ id, nombre, email, apellido }, secreta, { expiresIn });
};

//resolver
const resolvers = {
    Query: {
        obtenerUsuario: async (_, {}, ctx) => {
            /* const usuarioId = await jwt.verify(token, process.env.SECRETA);
            return usuarioId; */

            return ctx.usuario;
        },
        obtenerProductos: async () => {
            try {
                const productos = await Producto.find({});
                return productos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerProducto: async (_, { id }) => {
            const producto = await Producto.findById(id);
            if (!producto) {
                throw new Error("Producto no existe");
            }

            return producto;
        },
        obtenerClientes: async () => {
            try {
                const clientes = await Cliente.find({});
                return clientes;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerClientesVendedor: async (_, {}, ctx) => {
            //asignar vendedor
            const userId = ctx.usuario.id.toString();
            try {
                const clientes = await Cliente.find({ vendedor: userId });
                console.log(clientes);
                return clientes;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerCliente: async (_, { id }, ctx) => {
            const cliente = await Cliente.findById(id);
            if (!cliente) {
                throw new Error("Clitente no existe");
            }

            //el que lo creo lo puede ver
            if (cliente.vendedor.toString() !== ctx.usuario.id.toString()) {
                throw new Error("No tiene acceso");
            }
            return cliente;
        },
        obtenerPedidos: async () => {
            try {
                const pedidos = await Pedido.find({});
                return pedidos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerPedidosVendedor: async (_, {}, ctx) => {
            const userId = ctx.usuario.id;
            const gg = await Pedido.find({
                vendedor: userId,
            });
            console.log("ggg", JSON.stringify(gg));
            try {
                const pedidos = await Pedido.find({
                    vendedor: userId,
                }).populate("cliente");
                console.log("pedidos", JSON.stringify(pedidos));
                return pedidos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerPedido: async (_, { id }, ctx) => {
            const pedido = await Pedido.findById(id);
            if (!pedido) {
                throw new Error("Pedido no existe");
            }

            if (pedido.vendedor.toString() !== ctx.usuario.id.toString()) {
                throw new Error("No tiene acceso");
            }

            return pedido;
        },
        obtenerPedidoEstado: async (_, { estado }, ctx) => {
            const pedidos = await Pedido.find({
                vendedor: ctx.usuario.id,
                estado: estado,
            });
            return pedidos;
        },
        mejoresClientes: async () => {
            const clientes = await Pedido.aggregate([
                { $match: { estado: "COMPLETADO" } },
                {
                    $group: {
                        _id: "$cliente",
                        total: { $sum: "$total" },
                    },
                },
                {
                    $lookup: {
                        from: "clientes",
                        localField: "_id",
                        foreignField: "_id",
                        as: "cliente",
                    },
                },
                {
                    $limit: 10,
                },
                {
                    $sort: { total: -1 },
                },
            ]);

            return clientes;
        },
        mejoresVendedores: async () => {
            const vendedores = await Pedido.aggregate([
                { $match: { estado: "COMPLETADO" } },
                {
                    $group: {
                        _id: "$vendedor",
                        total: { $sum: "$total" },
                    },
                },
                {
                    $lookup: {
                        from: "usuarios",
                        localField: "_id",
                        foreignField: "_id",
                        as: "vendedor",
                    },
                },
                {
                    $limit: 3,
                },
                {
                    $sort: { total: -1 },
                },
            ]);

            return vendedores;
        },
        buscarProducto: async (_, { texto }) => {
            const productos = await Producto.find({
                $text: { $search: texto },
            }).limit(10);

            return productos;
        },
    },

    Mutation: {
        nuevoUsuario: async (_, { input }) => {
            const { email, password } = input;

            ///Revisar si el usuario ya existe
            const existeUsuario = await Usuario.findOne({ email });
            if (existeUsuario) {
                throw new Error("El usuario ya existe");
            }

            //Has passsword
            const salt = await bcryptjs.genSalt(10);
            input.password = await bcryptjs.hash(password, salt);

            //Guardar en la base de datos
            try {
                const usuario = new Usuario(input);
                usuario.save();
                return usuario;
            } catch (error) {
                console.log(error);
            }
        },
        autenticarUsuario: async (_, { input }) => {
            const { email, password } = input;
            //usuario existe
            const existeUsuario = await Usuario.findOne({ email });
            if (!existeUsuario) {
                throw new Error("El usuario no existe");
            }
            //revisar password
            const passwordCorrecto = await bcryptjs.compare(
                password,
                existeUsuario.password
            );
            if (!passwordCorrecto) {
                throw new Error("Usuario o password incorrecto");
            }
            //crear token
            return {
                token: crearToken(existeUsuario, process.env.SECRETA, "24h"),
            };
        },
        nuevoProducto: async (_, { input }) => {
            try {
                const producto = new Producto(input);
                //almacenar db
                const resultado = await producto.save();
                return resultado;
            } catch (error) {
                console.log(error);
            }
        },
        actualizarProducto: async (_, { id, input }) => {
            let producto = await Producto.findById(id);
            if (!producto) {
                throw new Error("Producto no existe");
            }

            //guardar en la base de producto
            producto = await Producto.findByIdAndUpdate({ _id: id }, input, {
                new: true,
            });

            return producto;
        },
        eliminarProducto: async (_, { id }) => {
            let producto = await Producto.findById(id);
            if (!producto) {
                throw new Error("Producto no existe");
            }

            try {
                await Producto.findOneAndDelete({ _id: id });
                return "Producto eliminado";
            } catch (error) {
                console.log(error);
            }
        },
        nuevoCliente: async (_, { input }, ctx) => {
            const { email } = input;
            //verifiar si existe
            let cliente = await Cliente.findOne({ email });

            if (cliente) {
                throw new Error("Cliente ya existe");
            }
            const nuevoCliente = new Cliente(input);

            //asignar vendedor
            nuevoCliente.vendedor = ctx.usuario.id;
            try {
                const resultado = await nuevoCliente.save();
                return resultado;
            } catch (error) {
                console.log(error);
            }
        },
        actualizarCliente: async (_, { id, input }, ctx) => {
            let cliente = await Cliente.findById(id);
            if (!cliente) {
                throw new Error("Cliente no existe");
            }

            //el que lo creo lo puede ver
            if (cliente.vendedor.toString() !== ctx.usuario.id.toString()) {
                throw new Error("No tiene acceso");
            }

            cliente = await Cliente.findByIdAndUpdate({ _id: id }, input, {
                new: true,
            });

            return cliente;
        },
        eliminarCliente: async (_, { id }, ctx) => {
            const cliente = await Cliente.findById(id);
            if (!cliente) {
                throw new Error("Cliente no existe");
            }

            //el que lo creo lo puede ver
            if (cliente.vendedor.toString() !== ctx.usuario.id.toString()) {
                throw new Error("No tiene acceso");
            }

            try {
                await Cliente.findOneAndDelete({ _id: id });
                return "Cliente eliminado";
            } catch (error) {
                console.log(error);
            }
        },
        nuevoPedido: async (_, { input }, ctx) => {
            console.log("data pedido", input);
            // verificar si cliente existe
            let cliente = await Cliente.findById(input.cliente);

            if (!cliente) {
                throw new Error("El cliente no existe");
            }

            // verificar si el cliente es del vendedor
            if (cliente.vendedor.toString() !== ctx.usuario.id.toString()) {
                throw new Error("No tiene acceso");
            }

            // Revisar que el stock este disponible
            for await (const articulo of input.pedido) {
                const { id } = articulo;
                const producto = await Producto.findById(id);

                if (articulo.cantidad > producto.existencia) {
                    throw new Error(
                        `El articulo: ${producto.nombre} excede la cantidad disponible`
                    );
                } else {
                    // restar la antidad a lo disponible
                    producto.existencia =
                        producto.existencia - articulo.cantidad;

                    await producto.save();
                }
            }

            // crear un nuevo pedido
            const nuevoPedido = new Pedido(input);

            // asignarle un vendedor
            nuevoPedido.vendedor = ctx.usuario.id;

            // guardar en la base de datos
            const resultado = await nuevoPedido.save();
            console.log("resultado pedido", resultado);
            return resultado;
        },
        actualizarPedido: async (_, { id, input }, ctx) => {
            //existe pedido
            const pedido = await Pedido.findById(id);
            if (!pedido) {
                throw new Error("Pedido no existe");
            }

            //el cliente existe
            const cliente = await Cliente.findById(input.cliente);
            if (!cliente) {
                throw new Error("Cliente no existe");
            }

            //cliente y pedido pertenece al vendedor
            if (cliente.vendedor.toString() !== ctx.usuario.id.toString()) {
                throw new Error("No tiene acceso");
            }

            // Revisar que el stock este disponible
            if (input.pedido) {
                for await (const articulo of input.pedido) {
                    const { id } = articulo;
                    const producto = await Producto.findById(id);

                    if (articulo.cantidad > producto.existencia) {
                        throw new Error(
                            `El articulo: ${producto.nombre} excede la cantidad disponible`
                        );
                    } else {
                        // restar la antidad a lo disponible
                        producto.existencia =
                            producto.existencia - articulo.cantidad;

                        await producto.save();
                    }
                }
            }

            //guardar el pedido
            const resultado = await Pedido.findOneAndUpdate(
                { _id: id },
                input,
                { new: true }
            );
            return resultado;
        },
        eliminarPedido: async (_, { id }, ctx) => {
            //existe pedido
            const pedido = await Pedido.findById(id);
            if (!pedido) {
                throw new Error("Pedido no existe");
            }

            //el que lo creo lo puede ver
            if (pedido.vendedor.toString() !== ctx.usuario.id.toString()) {
                throw new Error("No tiene acceso");
            }

            try {
                await Pedido.findOneAndDelete({ _id: id });
                return "Pedido eliminado";
            } catch (error) {
                console.log(error);
            }
        },
    },
};

module.exports = resolvers;
