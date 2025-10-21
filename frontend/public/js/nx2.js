var nxDownloadUrl = "https://www.infotech.co.kr/ExAdapter_Web_Setup_20221130.exe";

var nxMacDownloadUrl = "https://www.infotech.co.kr/iftnxweb_macos_x64_1.5.pkg";
var bMacOS = checkMacOS();

var menu = 'setupCheck';
var uid = '';

// Browser 체크
var agent = agent = window.navigator.userAgent.toLowerCase();
var browserName;
switch (true) {
    case agent.indexOf("edge") > -1: 
        browserName = "MS Edge"; // MS 엣지
        break;
    case agent.indexOf("edg/") > -1: 
        browserName = "Edge (chromium based)"; // 크롬 기반 엣지
        break;
    case agent.indexOf("opr") > -1 && !!window.opr: 
        browserName = "Opera"; // 오페라
        break;
    case agent.indexOf("chrome") > -1 && !!window.chrome: 
        browserName = "Chrome"; // 크롬
        break;
    case agent.indexOf("trident") > -1: 
        browserName = "MS IE"; // 익스플로러
        break;
    case agent.indexOf("firefox") > -1: 
        browserName = "Mozilla Firefox"; // 파이어 폭스
        break;
    case agent.indexOf("safari") > -1: 
        browserName = "Safari"; // 사파리
        break;
    default: 
        browserName = "other"; // 기타
}

$(document).ready(function (){
    $('.nav_btn').click(function () {
        let id=this.getAttribute('id');
        let message = "";
        $('.nav_btn').attr('class','nav_btn');
        $("#inputText").text('')
        $("#outputText").text('')
        if(id!="exportCert" && id!="exportCertWeb"){
            $('.content.main').css('display','flex');
            $('.content.cert').css('display','none');
        }
        switch(id){
            case "btn_setup": 
                menu='setupCheck';
                message = "로컬환경에 ExWeb 모듈이 정상적으로 설치되어 있는지 확인하는 기능입니다.<br/>" 
                +"설치확인이 되지 않는다면 Setup파일을 다운로드 받아 설치하고 다시 설치하시면 됩니다.";
                print_inJson('{"certImageUrl": "", "nxKeypad": ""}');
                break;
            case "btn_execute":
                menu='scraping';
                message = "서비스 입력값을 Json형태로 입력창에 기입하고 실행하기를 클릭하시면<br/>"
                +"처리결과는 바로 출력창에서 확인 하실 수 있습니다.";
                print_inJson('{"appCd": "InfotechApiDemo", "orgCd": "hometax", "svcCd": "Z0001", "bizNo": "1388148652"}');
                break;
            case "btn_cert_list":
                menu='certList';
                message="로컬환경에 보유하고 있는 공동인증서 목록을 추출하는 기능입니다.";
                break;
            case "btn_cert_select":
                menu='certListCS';
                message = "ExWeb에서 제공하는 공동인증서 선택창을 띄운 후 인증서를 선택하면 관련한 정보를 결과로 확인합니다.";
                print_inJson('{"certImageUrl": "", "nxKeypad": ""}');
                break;
            case "btn_cert_select_web":
                menu='certListWeb';
                message = "인증서 목록 불러오기 기능을 이용하여 받은 결과값을 이용하여 웹화면에 인증서 선택창을 구현한 샘플입니다.";
                document.getElementById('title_cert_list').innerText = '공동인증 전자서명';
                break;
            case "btn_export_cert":
                menu='exportCert';
                message = "당사의 모바일 엔진과 ExWeb에서 제공하는 공동인증서 선택창을 연동하여 로컬환경에서 모바일기기로 공동인증서를 이동하는 기능에 대한 샘플입니다.";
                $('.content.main').css('display','none');
                $('.content.cert').css('display','flex');
                break;
            case "btn_export_cert_web":
                menu='exportCertWeb';
                message = "당사의 모바일 엔진과 연동하여 로컬환경에서 모바일기기로 공동인증서를 이동하는 기능에 대한 샘플입니다.";
                document.getElementById('title_cert_list').innerText = '공동인증서 선택 이동';
                $('.content.main').css('display','none');
                $('.content.cert').css('display','flex');
                break;
        }
        $('#'+id).attr('class','nav_btn nav_click');
        document.getElementById('title_txt').innerHTML = message;
    });
});

function print_inJson(input){
    // var inJson = JSON.stringify(input);
    try {
        var jsonPretty = JSON.stringify(JSON.parse(input), null, 2);
        $("#inputText").text(jsonPretty);
    } catch (e) {
        $("#inputText").text(input);
    }
}

function print_receive(rtn) {
    var result = JSON.stringify(rtn);
    try {
        var jsonPretty = JSON.stringify(JSON.parse(result), null, 2);
        $("#outputText").text(jsonPretty);
    } catch (e) {
        $("#outputText").text(result);
    }
}

//
function execute(){
    switch(menu){
        //설치확인
        case "setupCheck": fnNxSetupCheck(); break;
        //수집
        case "scraping": fnNxScraping(); break;
        //인증서목록
        case "certList": fnNxCertList(); break;
        //인증서목록뷰(CS)
        case "certListCS": fnNxCertListCS(); break;
        //인증서목록(Web)
        case "certListWeb": popup(); break;
    }
}

//NX설치
function fnNxDownload(url) { // url : 파일 경로
	if (bMacOS == true)
	{
		url = nxMacDownloadUrl;
	}else{
		url = nxDownloadUrl;	
	}
    if(!$('#ifrFile').length) $("body").append($("<iframe/>",{id:"ifrFile",style:"display:none;"}));
    $('#ifrFile').attr('src', url ? url : nxDownloadUrl);
}

//NX설치확인
function fnNxSetupCheck(){
    pd = $('#inputText').text();
    $.ajax({
        type: "POST",
        url: "https://127.0.0.1:16566/?op=setup",
        data: pd,
        dataType: "json",
        contentType: 'application/json; charset=UTF-8',
        crossDomain: true,
        crossOrigin: true,
        success: function(data) {
            print_receive(data);
        },
        error: function(xhr, status, error) {
            $("#outputText").html("---------- result ----------\n");
            $("#outputText").html(status)
            fnNxDownload("https://www.infotech.co.kr/ExAdapter_Web_Setup_20221130.exe");
            if (browserName == "Mozilla Firefox") {
                alert("설치가 완료된 후에 브라우저를 닫고, 다시 시작하여 이용하시기 바랍니다.(Firefox browser)");
            }
        }
    });
}

//스크래핑실행
function fnNxScraping(){
    var pd = $("textarea#inputText").val();
    $.blockUI({
        message: '<div class=""></div><br><h3>수집진행중입니다. 잠시만 기다려주세요</h3>',
        fadeIn: 1000,
        overlayCSS: {
            backgroundColor: 'rgb(252,252,252)',
            opacity: 0.8,
            cursor: 'wait',
        },
        css: {
            border: 0,
            padding: 0,
            color: '#333',
            backgroundColor: 'transparent',
        },
    });
    $.ajax({
        type: "POST",
        url: "https://127.0.0.1:16566/?op=execute",
        data: pd,
        dataType: "json",
        contentType: 'application/json; charset=UTF-8',
        crossDomain: true,
        crossOrigin: true,
        success: function(data) {
            print_receive(data);
            $.unblockUI();
        },
        error: function(xhr, status, error) {
            $.unblockUI();
            $("#outputText").text("---------- result ----------\n");
            $("#outputText").text(status)
            fnNxDownload("https://www.infotech.co.kr/ExAdapter_Web_Setup_20221130.exe");
            if (browserName == "Mozilla Firefox") {
                alert("설치가 완료된 후에 브라우저를 닫고, 다시 시작하여 이용하시기 바랍니다.(Firefox browser)");
            }
        }
    });
}

//인증서목록
function fnNxCertList(){
    pd = $('#inputText').text();
    $.ajax({
        type: "POST",
        url: "https://127.0.0.1:16566/?op=certList",
        data: pd,
        dataType: "json",
        contentType: 'application/json; charset=UTF-8',
        crossDomain: true,
        crossOrigin: true,
        success: function(data) {
            print_receive(data);
        },
        error: function(xhr, status, error) {
            $("#outputText").text("---------- result ----------\n");
            $("#outputText").text(status)
            fnNxDownload("https://www.infotech.co.kr/ExAdapter_Web_Setup_20221130.exe");
            if (browserName == "Mozilla Firefox") {
                alert("설치가 완료된 후에 브라우저를 닫고, 다시 시작하여 이용하시기 바랍니다.(Firefox browser)");
            }
        }
    });
}

//인증서목록뷰 CS
function fnNxCertListCS(){
    pd = $('#inputText').text();
    if(pd===""){
        pd = '{"certImageUrl": "", "nxKeypad": ""}';
    }
    $.ajax({
        type: "POST",
        url: "https://127.0.0.1:16566/?op=certSelect",
        data: pd,
        // data: '{"certImageUrl": "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png", "nxKeypad": ""}',
        dataType: "json",
        contentType: 'application/json; charset=UTF-8',
        crossDomain: true,
        crossOrigin: true,
        success: function(data) {
            if(data.file1 != '' && data.file2 != ''){
                print_receive(data);
            } else {
                alert('인증서 선택을 취소했습니다.');
            }
        },
        error: function(xhr, status, error) {
			fnNxDownload("https://www.infotech.co.kr/ExAdapter_Web_Setup_20221130.exe");
            if (browserName == "Mozilla Firefox") {
                alert("설치가 완료된 후에 브라우저를 닫고, 다시 시작하여 이용하시기 바랍니다.(Firefox browser)");
            }
        }
    });
}

//인증서 선택취소
function certCancel(){
    // alert("인증 진행을 취소하셨습니다.")
    $("#tbody").empty();
    $('#signPw').val('');
    $('.dim-layer').fadeOut("fast"); // 닫기 버튼을 클릭하면 레이어가 닫힌다.
    var emptyObj = new Object();
    selectedCert = emptyObj;
    return false;
}

//인증서 팝업띄우기(Web)
function popup(){
    layer_popup("#layer2");
    var pd = $("textarea#tx_input").val();
    $.ajax({
        type: "POST",
        url: 'https://127.0.0.1:16566/?op=certList',
        data: pd,
        dataType: "json",
        contentType: 'application/json; charset=UTF-8',
        crossDomain: true,
        crossOrigin: true,
        success: function(data) {
            document.querySelector('#pop_table_tbody').innerHTML = '';
            data.list.forEach(function(item) {
                var tr = document.createElement("tr")
                tr.setAttribute("onclick", "selectNode(this)")
                tr.setAttribute("class", "cert_cont")
                //구분
                var td = document.createElement("td")
                td.setAttribute("class", "td1")
                var gubun = "";
                gubun = distingCert(item.oid);
                
                td.innerText = gubun 
                tr.appendChild(td);
                //인증서명
                td = document.createElement("td")
                // td.setAttribute("style", "width:230px;text-overflow:ellipsis;")
                td.setAttribute("class", "td2")
                td.innerText = item.certName
                tr.appendChild(td);

                // 만료일
                td = document.createElement("td")
                td.setAttribute("class", "td3")
                td.innerText = item.toDt
                tr.appendChild(td);

                //발급자
                td = document.createElement("td")
                td.setAttribute("class", "td4")
                td.innerText = item.pub
                tr.appendChild(td);
                
                //위치
                td = document.createElement("td")
                td.setAttribute("class", "td5")
                td.innerText = item.drive
                tr.appendChild(td);

                //Path (숨김처리)
                td = document.createElement("td")
                td.setAttribute("style", "display:none")
                td.innerText = item.path;
                tr.appendChild(td);

                document.getElementById("pop_table_tbody").appendChild(tr);       
            })
        },
        error: function(xhr, status, error) {
            $("textarea#tx_output").val("---------- result ----------\n");
            $("textarea#tx_output").val(status)
        }
    });
    
    function layer_popup(el){
        var $el = $(el);        //레이어의 id를 $el 변수에 저장
        $('.dim-layer').fadeIn("fast");

        var $elWidth = ~~($el.outerWidth()),
            $elHeight = ~~($el.outerHeight()),
            docWidth = $(document).width(),
            docHeight = $(document).height();

        // 화면의 중앙에 레이어를 띄운다.
        if ($elHeight < docHeight || $elWidth < docWidth) {
            $el.css({
                marginTop: -$elHeight /2,
                marginLeft: -$elWidth/2
            })
        } else {
            $el.css({top: 0, left: 0});
        }
    }
}


function fnCertSend(f, nxKeyPad) {
    var iftCertLink = "https://www.infotech.co.kr";

    var form = $(f);
    
    var defaultVO = new Object();
    defaultVO.url = iftCertLink + '/nx/src/nxCrtC.jsp';
    defaultVO.op = 'certP2S';
    defaultVO.nxLogoUrl = '';
    defaultVO.uid = form.find('input[name=uid00]').val() + form.find('input[name=uid01]').val() + form.find('input[name=uid02]').val()
    
    fnGetNxCrtData({
        data: defaultVO
        , beforeSend: function(vo) {
            return true;
        }
        , success: function(nxData) {
            alert('인증서가 복사되었습니다.\n스마트기기에서 다음 단계를 진행하세요.');
        }
        , error: function(errMsg) {
            alert(errMsg);
        }
    });
}

function fnGetNxCrtData(vo) {
	//validation
	var uidValid = true;
	if(!/^[0-9]{12}$/.test(vo.data.uid)) {
		vo.error('OTP(숫자 12자리를)를 확인하세요.');
		uidValid = false;
	}
	if(uidValid) {
		$.ajax({
			cache: false
			, url: vo.data.url
			, data: {
				'from': 'web'
				, 'op': 'checkOTP'
				, 'uid': vo.data.uid
				, 'type': 'session'
			}
			, success: function(d) {
				if(d.validOTP == 'N') {
					vo.error('OTP 번호가 만료되었거나 잘못입력했습니다.\nOTP 번호를 갱신하세요.');
				} else {
					var isValid = vo.beforeSend(vo);
					if(uidValid && isValid) {
                        if (menu=='exportCert') {
                            // windows 인증서 선택창열기
                            fnCertSelect(vo, function(data){
                                // 인증서 서명 암호화
                                fnCertInfoP2S(data)
                            });
                        } else {
                            // 인증서 Web 팝업
                            uid = vo.data.uid;
                            popup();
                        }
					}
				}
			}
			, error: function(e) {
				alert(e);
			}
		});
	}
}

// windows 인증서 선택창열기
function fnCertSelect(vo,func){
    $.ajax({
        type: "POST",
        url: "https://127.0.0.1:16566/?op=certSelect",
        data: '{"certImageUrl": "", "nxKeypad": ""}',
        // data: '{"certImageUrl": "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png", "nxKeypad": ""}',
        dataType: "json",
        contentType: 'application/json; charset=UTF-8',
        crossDomain: true,
        crossOrigin: true,
        success: function(data) {
            if(data.file1 != '' && data.file2 != ''){
                vo.certData = data;
                func(vo);
            } else {
                vo.error('인증서 선택을 취소했습니다.');
            }
        },
        error: function(xhr, status, error) {
            vo.error('NX업데이트가 필요합니다.');
			fnNxDownload("https://www.infotech.co.kr/ExAdapter_Web_Setup_20221130.exe");
            if (browserName == "Mozilla Firefox") {
                alert("설치가 완료된 후에 브라우저를 닫고, 다시 시작하여 이용하시기 바랍니다.(Firefox browser)");
            }
        }
    });
}

//인증서 서명값 암호화
function fnCertInfoP2S(data){
    let inJson = {
        'orgCd': 'common',
        'svcCd': 'GetCertInfoP2S',
        'signCert': data.certData.file1,
        'signPri': data.certData.file2,
        'uid': data.data.uid
    }
    $.ajax({
        type: "POST",
        url: "https://127.0.0.1:16566/?op=execute",
        data: JSON.stringify(inJson),
        dataType: "json",
        contentType: 'application/json; charset=UTF-8',
        crossDomain: true,
        crossOrigin: true,
        success: function(d) {
            //인증서 보내기
            if(d.data != '' ){
				if( d.errYn == "N" )
				{
					fnCertInfoSend(data,d);
				}else{
					alert(d.errMsg);
				}
			} else {
                //NX2 버전 문제로 재설치
                fnNxDownload("https://www.infotech.co.kr/ExAdapter_Web_Setup_20221130.exe");
                if (browserName == "Mozilla Firefox") {
                    alert("설치가 완료된 후에 브라우저를 닫고, 다시 시작하여 이용하시기 바랍니다.(Firefox browser)");
                }
            }
        },
        error: function(xhr, status, error) {
            fnNxDownload("https://www.infotech.co.kr/ExAdapter_Web_Setup_20221130.exe");
            if (browserName == "Mozilla Firefox") {
                alert("설치가 완료된 후에 브라우저를 닫고, 다시 시작하여 이용하시기 바랍니다.(Firefox browser)");
            }
        }
    });
}

//인증서 보내기
function fnCertInfoSend(vo,outJson){
    $.ajax({
        cache: false
        , url: vo.data.url
        , data: {
            'uid': vo.data.uid,
            'outJson': JSON.stringify(outJson),
            'op': 'certP2S'
        }
        , success: function(d) {
            vo.success('인증서가 복사되었습니다.\n스마트기기에서 다음 단계를 진행하세요.');
        }
        , error: function(e) {
            vo.error(e);
        }
    });
}

function getCertResult(){
    $.ajax({
        type: "POST",
        url: 'https://127.0.0.1:16566/?op=execute',
        data: JSON.stringify(selectedCert),
        dataType: "json",
        contentType: 'application/json; charset=UTF-8',
        crossDomain: true,
        crossOrigin: true,
        success: function(data) {
            if (menu=='certListWeb') {
                // 인증서목록뷰(Web)
                print_receive(data);
            } else if (menu=='exportCertWeb') {
                if ('N' == data.errYn) {
                    // 인증서이동(Web)
                    var iftCertLink = "https://www.infotech.co.kr";
                    let vo = {
                        'certData': {
                            'file1': data.DER2PEM,
                            'file2': data.KEY2PEM
                        },
                        'data': {
                            'uid': uid,
                            'url': iftCertLink + '/nx/src/nxCrtC.jsp'
                        },
                        success: function(data) {
                            alert('인증서가 복사되었습니다.\n스마트기기에서 다음 단계를 진행하세요.');
                        },
                        error: function(errMsg) {
                            alert(errMsg);
                        }
                    };
                    fnCertInfoP2S(vo);
                } else {
                    alert(data.errMsg||'시스템 오류 입니다.');
                }
            }
        },
        error: function(xhr, status, error) {
            if (menu=='certListWeb') {
                $("#outputText").text("---------- result ----------\n");
                $("#outputText").text(status)
            } else if (menu=='exportCertWeb') {
                alert(error);
            }
        }
    });
}

var selectedCert = new Object();
var s_gubun = "";
var s_certName = "";
var s_toDt = "";
var s_pub = "";
var s_path = "";
var s_drive = "";
var signCert = "";
var signPri = "";

function selectNode(el){
    $("tbody tr").css("border", "solid 1px #dfdfdf");
    $("tbody tr").css("background-color", "#dfdfdf");
    $(el).css("border", "solid 1px #E9493C");
    $(el).css("background-color", "#EE776D");
    s_gubun = el.children[0].innerText;
    s_certName = el.children[1].innerText;
    s_toDt = el.children[2].innerText;
    s_pub = el.children[3].innerText;
    s_drive = el.children[4].innerText;
    s_path = el.children[5].innerText;

    selectedCert.orgCd = "common";
    selectedCert.svcCd = "getCertInfo";
    selectedCert.appCd = "InfotechApiDemo";
	if (bMacOS == true)
	{
		selectedCert.signCert = s_path + "/signCert.der";
		selectedCert.signPri = s_path + "/signPri.key";
	}else{
		selectedCert.signCert = s_path + "\\signCert.der";
		selectedCert.signPri = s_path + "\\signPri.key";
	}
}

function checkMacOS(){
	var userOs = navigator.userAgent.replace(/ /g, '').toLowerCase()
      if( userOs.match(/macintosh/i) == "macintosh") {
        return true;
      }else{
        return false;
      }
}