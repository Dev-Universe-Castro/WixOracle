import { logar } from "backend/login.jsw";

import wixLocation from "wix-location";

import { session } from "wix-storage";


$w('#button1').onClick((event) => {
        let usuario = $w("#usuario")
    let senha = $w("#senha")
    //let alerta = $w("#alerta")

    if (usuario.value === "" || senha.value === "") {
        console.log("campos vazios")
    } else {

        logar(usuario.value, senha.value)

            .then((resultado) => {

                if (resultado.logado) {
                    session.setItem("usuario", JSON.stringify(resultado.usuario))
                    session.setItem("logado", JSON.stringify(true))
                    console.log(resultado.usuario)
                    console.log(resultado.logado)
					setTimeout(() => {
						wixLocation.to("/inicio")
					}, 200);
                }

            })
    }
})