// Guia de API: https://www.wix.com/velo/reference/api-overview/introduction
import { session } from 'wix-storage'
import wixLocation from 'wix-location';
import { local } from 'wix-storage';
import wixData from 'wix-data';

var logado = JSON.parse(session.getItem("logado"))

$w.onReady(function () {
    if (logado) {
        console.log("logado")
        $w("#section4").show()
    } else {
        session.clear()
        setTimeout(() => {
            wixLocation.to("https://metalcoredeveloper.wixstudio.com/beneficiamento")
        }, 1);
    }

    graficosSeparadores()
    graficosHidrociclone()

});

//nomeTXT
var usuario = JSON.parse(session.getItem("usuario"))
var nome = usuario.nome

var animacaoBollean = false

$w.onReady(function () {

    $w("#button5").label = nome
    console.log(JSON.parse(session.getItem("usuario")))

});

$w('#button5').onClick((event) => {
    let animacao = {

        "direction": "top",
        "duration": 500
    }

})

/*$w('#button6').onClick((event) => {
    session.clear()
    setTimeout(() => {
        wixLocation.to("https://metalcoredeveloper.wixstudio.com/producao")
    }, 200);
})*/

function graficosSeparadores() {
    let datas = [];
    let SPMAG01 = [];
    let SPMAG02 = [];
    let SPMAG03 = [];

    function formatData(rawDate) {
        let match = rawDate.match(/^(\d{2})T.*?\/(\d{2})\/(\d{4})$/);
        if (match) {
            const [_, dia, mes, ano] = match;
            return `${dia}/${mes}/${ano}`;
        }

        match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})T/);
        if (match) {
            const [_, ano, mes, dia] = match;
            return `${dia}/${mes}/${ano}`;
        }

        console.warn(`Data inválida ou formato desconhecido: ${rawDate}`);
        return "00/00/0000";
    }

    function getDate15DaysAgo() {
        const today = new Date();
        today.setDate(today.getDate() - 15);
        return today;
    }

    const data15DiasAtras = getDate15DaysAgo();

    // Primeira query: filtrar quantos registros dos últimos 15 dias existem
    wixData.query("SANKHYA/AD_DIARIOBORDO")
        .descending("DATA")
        .limit(500)
        .find()
        .then((res) => {
            const filtrados = res.items.filter(item => new Date(item.DATA) >= data15DiasAtras);
            const limiteNecessario = filtrados.length;

            // Segunda query com o limite correto
            return wixData.query("SANKHYA/AD_DIARIOBORDO")
                .descending("DATA")
                .limit(limiteNecessario)
                .find();
        })
        .then((results) => {
            console.log("Total de registros filtrados para gráfico de separadores:", results.items.length);

            let dataMap = {};

            results.items.forEach((item) => {
                const data = item.DATA;
                const formattedDate = formatData(data);
                if (formattedDate === "00/00/0000") return;

                if (!dataMap[formattedDate]) {
                    dataMap[formattedDate] = {
                        SPMAG01: [],
                        SPMAG02: [],
                        SPMAG03: []
                    };
                }

                if (item.SPMAG01 && !isNaN(parseFloat(item.SPMAG01))) {
                    dataMap[formattedDate].SPMAG01.push(parseFloat(item.SPMAG01));
                }

                if (item.SPMAG02 && !isNaN(parseFloat(item.SPMAG02))) {
                    dataMap[formattedDate].SPMAG02.push(parseFloat(item.SPMAG02));
                }

                if (item.SPMAG03 && !isNaN(parseFloat(item.SPMAG03))) {
                    dataMap[formattedDate].SPMAG03.push(parseFloat(item.SPMAG03));
                }
            });

            Object.keys(dataMap).forEach((data) => {
                datas.push(data);

                const SPMAG01media = dataMap[data].SPMAG01.length > 0
                    ? dataMap[data].SPMAG01.reduce((sum, val) => sum + val, 0) / dataMap[data].SPMAG01.length
                    : 0;
                const SPMAG02media = dataMap[data].SPMAG02.length > 0
                    ? dataMap[data].SPMAG02.reduce((sum, val) => sum + val, 0) / dataMap[data].SPMAG02.length
                    : 0;
                const SPMAG03media = dataMap[data].SPMAG03.length > 0
                    ? dataMap[data].SPMAG03.reduce((sum, val) => sum + val, 0) / dataMap[data].SPMAG03.length
                    : 0;

                SPMAG01.push(parseFloat(SPMAG01media.toFixed(2)));
                SPMAG02.push(parseFloat(SPMAG02media.toFixed(2)));
                SPMAG03.push(parseFloat(SPMAG03media.toFixed(2)));
            });

            datas.reverse();
            SPMAG01.reverse();
            SPMAG02.reverse();
            SPMAG03.reverse();

            let dados = {
                title: "",
                labels: datas,
                datasets: [
                    {
                        name: 'SPMAG01',
                        data: SPMAG01,
                        type: 'line',
                        borderColor: '#FF5733',
                        borderWidth: 2
                    },
                    {
                        name: 'SPMAG02',
                        data: SPMAG02,
                        type: 'line',
                        borderColor: '#33FF57',
                        borderWidth: 2
                    },
                    {
                        name: 'SPMAG03',
                        data: SPMAG03,
                        type: 'line',
                        borderColor: '#3357FF',
                        borderWidth: 2
                    }
                ]
            };

            console.log("Dados enviados para o gráfico de separadores:", dados);

            $w("#imageX4").hide();
            $w("#html2").postMessage(dados);
            $w("#html2").onMessage((event) => {
                if (event.data.type === 'ready') {
                    $w("#html2").postMessage(dados);
                }
            });
        })
        .catch((error) => {
            console.error("Erro ao buscar dados de separadores:", error);
        });
}


function graficosHidrociclone() {
    let datas = [];
    let hidrocicloneMedio = [];

    function formatData(rawDate) {
        let match = rawDate.match(/^(\d{2})T.*?\/(\d{2})\/(\d{4})$/);
        if (match) {
            const [_, dia, mes, ano] = match;
            return `${dia}/${mes}/${ano}`;
        }

        match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})T/);
        if (match) {
            const [_, ano, mes, dia] = match;
            return `${dia}/${mes}/${ano}`;
        }

        console.warn(`Data inválida ou formato desconhecido: ${rawDate}`);
        return "00/00/0000";
    }

    function getDate15DaysAgo() {
        const today = new Date();
        today.setDate(today.getDate() - 15);
        return today;
    }

    const data15DiasAtras = getDate15DaysAgo();

    // Primeira query para saber quantos registros estão dentro dos últimos 15 dias
    wixData.query("SANKHYA/AD_DIARIOBORDO")
        .descending("DATA")
        .limit(500)
        .find()
        .then((res) => {
            const filtrados = res.items.filter(item => new Date(item.DATA) >= data15DiasAtras);
            const limiteNecessario = filtrados.length;

            // Segunda query com o limite necessário
            return wixData.query("SANKHYA/AD_DIARIOBORDO")
                .descending("DATA")
                .limit(limiteNecessario)
                .find();
        })
        .then((results) => {
            console.log("Total de registros filtrados para gráfico de hidrociclone:", results.items.length);

            let dataMap = {};

            results.items.forEach((item) => {
                const data = item.DATA;
                if (!dataMap[data]) {
                    dataMap[data] = {
                        HIDROCICLONE: 0,
                        count: 0
                    };
                }

                const valor = parseFloat(item["HIDROCICLONE"]);
                if (!isNaN(valor)) {
                    dataMap[data].HIDROCICLONE += valor;
                    dataMap[data].count += 1;
                }
            });

            Object.keys(dataMap).forEach((data) => {
                const formattedDate = formatData(data);
                if (formattedDate === "00/00/0000") return;

                datas.push(formattedDate);

                const mediaHidrociclone = dataMap[data].count > 0
                    ? parseFloat((dataMap[data].HIDROCICLONE / dataMap[data].count).toFixed(2))
                    : 0;

                hidrocicloneMedio.push(mediaHidrociclone);
            });

            datas.reverse();
            hidrocicloneMedio.reverse();

            let dados = {
                title: "",
                labels: datas,
                datasets: [{
                    name: 'MÉDIA HIDROCICLONE',
                    data: hidrocicloneMedio,
                    type: 'line',
                    backgroundColor: '#007BFF',
                    borderColor: '#007BFF',
                    borderWidth: 2
                }]
            };

            console.log("Dados enviados para o gráfico de hidrociclone:", dados);

            $w("#imageX5").hide();
            $w("#html1").postMessage(dados);
            $w("#html1").onMessage((event) => {
                if (event.data.type === 'ready') {
                    $w("#html1").postMessage(dados); // Corrigido: estava #html2
                }
            });
        })
        .catch((error) => {
            console.error("Erro ao buscar dados de hidrociclone:", error);
        });
}
