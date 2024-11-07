#![feature(never_type, impl_trait_in_assoc_type, result_flattening)]
#![expect(
    clippy::unwrap_used,
    clippy::print_stdout,
    clippy::use_debug,
    unused_variables,
    reason = "example"
)]

extern crate alloc;

use alloc::vec;
use core::{error::Error, fmt::Debug};
use std::time::Instant;

use bytes::Buf;
use error_stack::{FutureExt as _, Report, ResultExt as _};
use frunk::HList;
use futures::{Stream, StreamExt as _, TryFutureExt as _, TryStreamExt as _, pin_mut, stream};
use graph_types::account::AccountId;
use harpc_client::{Client, ClientConfig, connection::Connection};
use harpc_codec::{decode::Decoder, encode::Encoder, json::JsonCodec};
use harpc_server::{Server, ServerConfig, router::RouterBuilder, serve::serve, session::SessionId};
use harpc_system::{
    Subsystem, SubsystemIdentifier,
    delegate::SubsystemDelegate,
    procedure::{Procedure, ProcedureIdentifier},
    role,
};
use harpc_tower::{
    Extensions,
    body::{Body, BodyExt as _},
    layer::{
        body_report::HandleBodyReportLayer, boxed::BoxedResponseLayer, report::HandleReportLayer,
    },
    request::{self, Request},
    response::{Parts, Response},
};
use harpc_types::{
    procedure::{ProcedureDescriptor, ProcedureId},
    response_kind::ResponseKind,
    subsystem::SubsystemId,
    version::Version,
};
use multiaddr::multiaddr;
use tower::ServiceExt as _;
use uuid::Uuid;

#[derive(Debug, Copy, Clone)]
enum System {
    Account,
}

impl SubsystemIdentifier for System {
    fn from_id(id: SubsystemId) -> Option<Self>
    where
        Self: Sized,
    {
        match id.value() {
            0x00 => Some(Self::Account),
            _ => None,
        }
    }

    fn into_id(self) -> SubsystemId {
        match self {
            Self::Account => SubsystemId::new(0x00),
        }
    }
}

enum AccountProcedureId {
    CreateAccount,
}

impl ProcedureIdentifier for AccountProcedureId {
    type Subsystem = Account;

    fn from_id(id: ProcedureId) -> Option<Self> {
        match id.value() {
            0 => Some(Self::CreateAccount),
            _ => None,
        }
    }

    fn into_id(self) -> ProcedureId {
        match self {
            Self::CreateAccount => ProcedureId::new(0),
        }
    }
}

struct Account;

impl Subsystem for Account {
    type ProcedureId = AccountProcedureId;
    type Procedures = HList![CreateAccount];
    type SubsystemId = System;

    const ID: System = System::Account;
    const VERSION: Version = Version {
        major: 0x00,
        minor: 0x00,
    };
}

#[derive(serde::Serialize, serde::Deserialize)]
struct CreateAccount {
    id: Option<AccountId>,
}

impl Procedure for CreateAccount {
    type Subsystem = Account;

    const ID: <Self::Subsystem as Subsystem>::ProcedureId = AccountProcedureId::CreateAccount;
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, thiserror::Error)]
enum AccountError {
    #[error("unable to establish connection to server")]
    Connection,
    #[error("unable to encode request")]
    Encode,
    #[error("unable to decode response")]
    Decode,
    #[error("expected at least a single response")]
    ExpectedResponse,
}

trait AccountSystem<R>
where
    R: role::Role,
{
    fn create_account(
        &self,
        session: &R::Session,
        payload: CreateAccount,
    ) -> impl Future<Output = Result<AccountId, Report<AccountError>>> + Send;
}

#[derive(Debug, Clone)]
struct AccountSystemImpl;

impl<S> AccountSystem<role::Server<S>> for AccountSystemImpl
where
    S: Send + Sync,
{
    async fn create_account(
        &self,
        session: &S,
        payload: CreateAccount,
    ) -> Result<AccountId, Report<AccountError>> {
        Ok(AccountId::new(Uuid::new_v4()))
    }
}

#[derive(Debug, Clone)]
struct AccountSystemClient;

impl<Svc, St, C, DecoderError, EncoderError, ServiceError, ResData, ResError>
    AccountSystem<role::Client<Connection<Svc, C>>> for AccountSystemClient
where
    // TODO: I want to get rid of the boxed stream here, the problem is just that `Output` has `<Input>`
    // as a type parameter, therefore cannot parameterize over it, unless we box or duplicate the
    // trait requirement. both are not great solutions.
    Svc: tower::Service<
            Request<stream::Iter<vec::IntoIter<C::Buf>>>,
            Response = Response<St>,
            Error = Report<ServiceError>,
            Future: Send,
        > + Clone
        + Send
        + Sync,
    St: Stream<Item = Result<ResData, ResError>> + Send + Sync,
    ResData: Buf,
    C: Encoder<Error = Report<EncoderError>, Buf: Send + 'static>
        + Decoder<Error = Report<DecoderError>>
        + Clone
        + Send
        + Sync,
    DecoderError: Error + Send + Sync + 'static,
    EncoderError: Error + Send + Sync + 'static,
    ServiceError: Error + Send + Sync + 'static,
{
    fn create_account(
        &self,
        session: &Connection<Svc, C>,
        payload: CreateAccount,
    ) -> impl Future<Output = Result<AccountId, Report<AccountError>>> {
        let codec = session.codec().clone();
        let connection = session.clone();

        // In theory we could also skip the allocation here, but the problem is that in that case we
        // would send data that *might* be malformed, or is missing data. Instead of skipping said
        // data we allocate. In future we might want to instead have something like
        // tracing::error or a panic instead, but this is sufficient for now.
        // (more importantly it also opt us out of having a stream as input that we then encode,
        // which should be fine?)
        //
        // In theory we'd need to be able to propagate the error into the transport layer, while
        // possible we would await yet another challenge, what happens if the transport layer
        // encounters an error? We can't very well send that error to the server just for us to
        // return it, the server might already be processing things and now suddenly needs to stop?
        // So we'd need to panic or filter on the client and would have partially committed data on
        // the server.
        //
        // This circumvents the problem because we just return an error early, in the future - if
        // the need arises - we might want to investigate request cancellation (which should be
        // possible in the protocol).
        //
        // That'd allow us to cancel the request but would make response handling *a lot* more
        // complex.
        //
        // This isn't a solved problem at all in e.g. rust in general, because there are some things
        // you can't just cancel. How do you roll back a potentially already committed transaction?
        // The current hypothesis is that the overhead required for one less allocation simply isn't
        // worth it, but in the future we might want to revisit this.
        codec
            .clone()
            .encode(stream::iter([payload]))
            .try_collect()
            .change_context(AccountError::Encode)
            .map_ok(|bytes: Vec<_>| {
                Request::from_parts(
                    request::Parts {
                        subsystem: Account::descriptor(),
                        procedure: ProcedureDescriptor {
                            id: CreateAccount::ID.into_id(),
                        },
                        session: SessionId::CLIENT,
                        extensions: Extensions::new(),
                    },
                    stream::iter(bytes),
                )
            })
            .and_then(move |request| {
                connection
                    .oneshot(request)
                    .change_context(AccountError::Connection)
            })
            .and_then(move |response| {
                let (parts, body) = response.into_parts();

                let data = codec.decode(body);

                async move {
                    tokio::pin!(data);

                    let data = data
                        .next()
                        .await
                        .ok_or_else(|| Report::new(AccountError::ExpectedResponse))?
                        .change_context(AccountError::Decode)?;

                    Ok(data)
                }
            })
    }
}

#[derive(Debug, Clone)]
struct AccountServerDelegate<T> {
    subsystem: T,
}

impl<T, S, C> SubsystemDelegate<S, C> for AccountServerDelegate<T>
where
    T: AccountSystem<role::Server<S>> + Send + Sync,
    S: Send + Sync,
    C: Encoder<Error: Debug> + Decoder<Error: Debug> + Clone + Send + Sync + 'static,
{
    type Error = Report<AccountError>;
    type Subsystem = Account;

    type Body<Source>
        = impl Body<Control: AsRef<ResponseKind>, Error = <C as Encoder>::Error>
    where
        Source: Body<Control = !, Error: Send + Sync> + Send + Sync;

    async fn call<B>(
        self,
        request: Request<B>,
        session: S,
        codec: C,
    ) -> Result<Response<Self::Body<B>>, Self::Error>
    where
        B: Body<Control = !, Error: Send + Sync> + Send + Sync,
    {
        let session_id = request.session();
        let ProcedureDescriptor { id } = request.procedure();
        let id = AccountProcedureId::from_id(id).unwrap();

        match id {
            AccountProcedureId::CreateAccount => {
                let body = request.into_body();
                let data = body.into_stream().into_data_stream();

                let stream = codec.clone().decode(data);
                pin_mut!(stream);

                let payload = stream.next().await.unwrap().unwrap();

                let account_id = self.subsystem.create_account(&session, payload).await?;
                let data = codec.encode(stream::iter([account_id]));

                Ok(Response::from_ok(Parts::new(session_id), data))
            }
        }
    }
}

async fn server() {
    let server = Server::new(ServerConfig::default()).expect("should be able to start service");

    let router = RouterBuilder::new::<()>(JsonCodec)
        .with_builder(|builder| {
            builder
                .layer(BoxedResponseLayer::new())
                .layer(HandleReportLayer::new())
                .layer(HandleBodyReportLayer::new())
        })
        .register(AccountServerDelegate {
            subsystem: AccountSystemImpl,
        });

    let task = router.background_task(server.events());
    tokio::spawn(task.into_future());

    let router = router.build();

    serve(
        server
            .listen(multiaddr![Ip4([0, 0, 0, 0]), Tcp(10500_u16)])
            .await
            .expect("should be able to listen"),
        router,
    )
    .await;
}

async fn client() {
    let client =
        Client::new(ClientConfig::default(), JsonCodec).expect("should be able to start service");

    let service = AccountSystemClient;

    let connection = client
        .connect(multiaddr![Ip4([127, 0, 0, 1]), Tcp(10500_u16)])
        .await
        .expect("should be able to connect");

    for _ in 0..16 {
        let now = Instant::now();
        let account_id = service
            .create_account(&connection, CreateAccount { id: None })
            .await
            .expect("should be able to create account");

        println!("account_id: {account_id:?}, took: {:?}", now.elapsed());
    }
}

#[tokio::main]
async fn main() {
    if std::env::args().nth(1) == Some("server".to_owned()) {
        server().await;
    } else {
        client().await;
    }
}
